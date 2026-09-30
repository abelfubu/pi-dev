import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface Target { repo: string; pr: number }
export interface Snapshot { headSha: string; state: string; comments: unknown[]; reviews: unknown[]; threads: unknown[]; checks: unknown[] }
export interface RecordState extends Target {
  revision: number; fetchedAt?: string; error?: string; snapshot?: Snapshot;
}
export interface Subscription extends Target { consumer: string; expiresAt: number; acknowledged: number; worktree?: string }
interface Data { version: 1; account?: string; records: Record<string, RecordState>; subscriptions: Record<string, Subscription> }
export function key(target: Target): string { return `${target.repo.toLowerCase()}#${target.pr}`; }
export function subscriptionKey(consumer: string, target: Target): string { return `${consumer}:${key(target)}`; }
export function validateTarget(value: Target): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]*\/[A-Za-z0-9_.-]+$/.test(value.repo) || [".", ".."].includes(value.repo.split("/")[1]) || !Number.isSafeInteger(value.pr) || value.pr < 1) throw new Error("Expected OWNER/REPO and a positive PR number");
}

/** Single daemon writer; atomic replacement keeps last committed state readable. */
export class Store {
  data: Data = { version: 1, records: {}, subscriptions: {} };
  private writes: Promise<void> = Promise.resolve();
  constructor(readonly file: string) {}
  async load(): Promise<void> {
    try {
      const data = JSON.parse(await readFile(this.file, "utf8")) as Data;
      if (data.version !== 1 || !data.records || !data.subscriptions) throw new Error("Unsupported watcher state format");
      this.data = data;
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }
  save(): Promise<void> {
    const contents = JSON.stringify(this.data);
    this.writes = this.writes.catch(() => {}).then(async () => {
      await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
      const temporary = `${this.file}.tmp`;
      await writeFile(temporary, contents, { mode: 0o600 });
      await rename(temporary, this.file);
    });
    return this.writes;
  }
  active(now = Date.now()): Subscription[] {
    return Object.values(this.data.subscriptions).filter(s => s.expiresAt > now);
  }
  register(consumer: string, target: Target, leaseSeconds = 14400, worktree?: string): Subscription {
    validateTarget(target);
    if (!consumer || consumer.length > 200) throw new Error("Invalid consumer ID");
    if (!Number.isFinite(leaseSeconds) || leaseSeconds < 30 || leaseSeconds > 86400) throw new Error("Lease must be 30–86400 seconds");
    const id = subscriptionKey(consumer, target);
    const old = this.data.subscriptions[id];
    return this.data.subscriptions[id] = { ...target, repo: target.repo.toLowerCase(), consumer, expiresAt: Date.now() + leaseSeconds * 1000, acknowledged: old?.acknowledged ?? 0, worktree: worktree ?? old?.worktree };
  }
  acknowledge(consumer: string, target: Target, revision: number): void {
    const subscription = this.data.subscriptions[subscriptionKey(consumer, target)];
    const record = this.data.records[key(target)];
    if (!subscription || !record || !Number.isSafeInteger(revision) || revision < 0 || revision > record.revision) throw new Error("Invalid acknowledgment");
    subscription.acknowledged = Math.max(subscription.acknowledged, revision);
  }
  update(target: Target, snapshot: Snapshot): RecordState {
    const old = this.data.records[key(target)];
    const changed = JSON.stringify(old?.snapshot) !== JSON.stringify(snapshot) || Boolean(old?.error);
    return this.data.records[key(target)] = { ...target, snapshot, revision: (old?.revision ?? 0) + (changed ? 1 : 0), fetchedAt: new Date().toISOString() };
  }
  fail(target: Target, error: string): void {
    const old = this.data.records[key(target)];
    this.data.records[key(target)] = { ...target, ...old, revision: old?.revision ?? 0, error };
  }
}
