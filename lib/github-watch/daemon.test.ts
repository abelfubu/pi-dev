import { it, expect, vi } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runDaemon } from "./daemon.js";
import { listen, request, type Change } from "./client.js";
import type { Snapshot } from "./state.js";

it("shares polling, streams changes, replays pending work, and isolates acknowledgments", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ghw-"));
  vi.stubEnv("PI_GITHUB_WATCH_DIR", directory);
  const target = { repo: "org/server", pr: 742 };
  let snapshot: Snapshot = { headSha: "abc", state: "OPEN", comments: [], reviews: [], threads: [], checks: [] };
  const fetch = vi.fn(async () => { await new Promise(resolve => setTimeout(resolve, 20)); return snapshot; });
  let stop: (() => Promise<void>) | undefined;
  const closers: Array<() => void> = [];
  try {
    stop = await runDaemon(fetch);
    await expect(runDaemon(fetch)).rejects.toThrow("already running");
    await Promise.all([request({ op: "watch", consumer: "a", target }), request({ op: "watch", consumer: "b", target })]);
    await request({ op: "refresh", target });
    expect(fetch).toHaveBeenCalledTimes(1);
    const events: Change[] = [];
    closers.push(listen("a", change => events.push(change), () => {}));
    await vi.waitFor(() => expect(events).toHaveLength(1));
    expect(events[0].revision).toBe(1);
    await request({ op: "ack", consumer: "a", target, revision: 1 });
    snapshot = { ...snapshot, comments: [{ id: 1, body: "feedback" }] };
    await request({ op: "refresh", target });
    await vi.waitFor(() => expect(events).toHaveLength(2));
    expect(events[1].revision).toBe(2);
    await request({ op: "cancel", consumer: "a", target });
    await request({ op: "watch", consumer: "a", target: { ...target, repo: "ORG/Server" } });
    await vi.waitFor(() => expect(events).toHaveLength(3));
    expect(events[2].revision).toBe(2);
    expect(fetch).toHaveBeenCalledTimes(2);
    const list = await request({ op: "list" });
    expect(list.subscriptions.find((s: any) => s.consumer === "b").acknowledged).toBe(0);
    closers.forEach(close => close());
    await stop();
    stop = await runDaemon(fetch);
    const replay: Change[] = [];
    closers.push(listen("a", change => replay.push(change), () => {}));
    await vi.waitFor(() => expect(replay[0]?.revision).toBe(2));
    await request({ op: "cancel", consumer: "a", target });
    expect((await request({ op: "list", consumer: "a" })).subscriptions).toHaveLength(0);
    const status = await request({ op: "status", target });
    expect(status).toMatchObject({ revision: 2, stale: false });
  } finally {
    closers.forEach(close => close());
    await stop?.(); vi.unstubAllEnvs();
    await rm(directory, { recursive: true, force: true });
  }
});
