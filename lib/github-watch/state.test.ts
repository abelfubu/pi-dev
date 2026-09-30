import { describe, it, expect } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store, subscriptionKey, type Snapshot } from "./state.js";
const target = { repo: "org/server", pr: 742 };
const snapshot: Snapshot = { headSha: "abc", state: "OPEN", comments: [], reviews: [], threads: [], checks: [] };

describe("watch state", () => {
  it("deduplicates snapshots but detects edits, resolution, CI and head changes", () => {
    const store = new Store("unused");
    expect(store.update(target, snapshot).revision).toBe(1);
    expect(store.update(target, structuredClone(snapshot)).revision).toBe(1);
    expect(store.update(target, { ...snapshot, comments: [{ id: 1, body: "edited" }] }).revision).toBe(2);
    expect(store.update(target, { ...snapshot, headSha: "def" }).revision).toBe(3);
  });
  it("retains last good state after failed reads", () => {
    const store = new Store("unused");
    store.update(target, snapshot);
    store.fail(target, "offline");
    expect(store.data.records["org/server#742"]).toMatchObject({ revision: 1, error: "offline", snapshot });
    const recovered = store.update(target, snapshot);
    expect(recovered.revision).toBe(2);
    expect(recovered.error).toBeUndefined();
  });
  it("keeps acknowledgments independent and does not clear newer generations", () => {
    const store = new Store("unused");
    store.register("one", target); store.register("two", target);
    store.update(target, snapshot);
    store.update(target, { ...snapshot, headSha: "new" });
    store.acknowledge("one", target, 1);
    expect(store.data.subscriptions[subscriptionKey("one", target)].acknowledged).toBe(1);
    expect(store.data.subscriptions[subscriptionKey("two", target)].acknowledged).toBe(0);
    expect(() => store.acknowledge("one", target, 3)).toThrow();
  });
  it("uses idempotent registration and bounded leases", () => {
    const store = new Store("unused");
    store.register("one", target, 30); store.register("one", target, 30);
    expect(store.active()).toHaveLength(1);
    expect(store.active(Date.now() + 31000)).toHaveLength(0);
    expect(() => store.register("one", target, Infinity)).toThrow();
    expect(() => store.register("one", { repo: "../bad", pr: 1 })).toThrow();
  });
  it("restores snapshots, leases, and pending consumer revisions", async () => {
    const dir = await mkdtemp(join(tmpdir(), "watch-state-"));
    try {
      const store = new Store(join(dir, "state.json"));
      store.register("one", target); store.update(target, snapshot);
      await store.save();
      const restored = new Store(store.file); await restored.load();
      expect(restored.data).toEqual(store.data);
    } finally { await rm(dir, { recursive: true }); }
  });
});
