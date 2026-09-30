import { createServer, type Socket } from "node:net";
import { chmod, mkdir, open, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { Store, key, subscriptionKey, validateTarget, type Target, type Snapshot } from "./state.js";
import { fetchSnapshot, ghJson } from "./github.js";
import { protocolVersion, socketPath, watchDirectory, type Request } from "./client.js";

export async function runDaemon(fetch: (target: Target) => Promise<Snapshot> = fetchSnapshot, account?: string): Promise<() => Promise<void>> {
  const directory = watchDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await chmod(directory, 0o700);
  const lockPath = join(directory, "daemon.lock");
  let lock;
  try { lock = await open(lockPath, "wx", 0o600); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    const pid = Number(await readFile(lockPath, "utf8"));
    if (!Number.isSafeInteger(pid) || pid < 1) throw new Error("Watcher is starting or has an invalid lock; inspect daemon.lock");
    try { process.kill(pid, 0); throw new Error("Watcher daemon already running"); }
    catch (probe) { if ((probe as NodeJS.ErrnoException).code !== "ESRCH") throw probe; }
    throw new Error("Stale daemon.lock: remove it after verifying the recorded PID is not running");
  }
  try { await lock.writeFile(String(process.pid)); }
  catch (error) { await unlink(lockPath).catch(() => {}); throw error; }
  finally { await lock.close(); }

  const store = new Store(join(directory, "state.json"));
  const clients = new Map<Socket, { consumer: string; sent: Map<string, number>; expired: Set<string> }>();
  const sockets = new Set<Socket>();
  const handlers = new Set<Promise<void>>();
  const inFlight = new Map<string, Promise<void>>();
  const schedule = new Map<string, { next: number; errors: number }>();
  let stopped = false;
  let loaded = false;
  let committing = false;
  let persistenceError: string | undefined;
  let commits: Promise<unknown> = Promise.resolve();
  let fetches: Promise<unknown> = Promise.resolve();
  let timer: NodeJS.Timeout | undefined;
  const emit = (socket: Socket, event: unknown) => {
    if (socket.destroyed) return;
    if (socket.writableLength > 1024 * 1024) socket.destroy();
    else socket.write(JSON.stringify(event) + "\n");
  };
  const publish = () => {
    if (committing || stopped) return;
    for (const [socket, client] of clients) {
      for (const subscription of Object.values(store.data.subscriptions)) {
        if (subscription.consumer !== client.consumer || subscription.expiresAt > Date.now()) continue;
        const expiry = `${key(subscription)}:${subscription.expiresAt}`;
        if (!client.expired.has(expiry)) {
          client.expired.add(expiry);
          emit(socket, { type: "expired", repo: subscription.repo, pr: subscription.pr });
        }
      }
      for (const subscription of store.active().filter(s => s.consumer === client.consumer)) {
        const id = key(subscription), record = store.data.records[id];
        if (!record || record.revision <= subscription.acknowledged || record.revision <= (client.sent.get(id) ?? 0)) continue;
        client.sent.set(id, record.revision);
        emit(socket, { type: "changed", repo: subscription.repo, pr: subscription.pr, revision: record.revision, worktree: subscription.worktree });
      }
    }
  };
  // Every mutation is serialized with persistence. Failed saves restore committed memory.
  const commit = <T>(mutation: () => T): Promise<T> => {
    const transaction = commits.catch(() => {}).then(async () => {
      if (stopped) throw new Error("Watcher is shutting down");
      const previous = structuredClone(store.data);
      committing = true;
      try {
        const result = mutation();
        await store.save();
        persistenceError = undefined;
        return result;
      } catch (error) {
        store.data = previous;
        persistenceError = (error as Error).message;
        throw error;
      } finally { committing = false; }
    });
    commits = transaction;
    return transaction.then(result => { publish(); return result; });
  };
  const reconcile = (target: Target): Promise<void> => {
    if (stopped) return Promise.reject(new Error("Watcher is shutting down"));
    const id = key(target);
    const running = inFlight.get(id);
    if (running) return running;
    const work = fetches.catch(() => {}).then(async () => {
      if (stopped) return;
      let snapshot: Snapshot;
      try { snapshot = await fetch(target); }
      catch (error) {
        if (stopped) return;
        const errors = (schedule.get(id)?.errors ?? 0) + 1;
        schedule.set(id, { next: Date.now() + Math.min(300000, 30000 * 2 ** Math.min(errors, 4)), errors });
        await commit(() => store.fail(target, (error as Error).message));
        return;
      }
      if (stopped) return;
      schedule.set(id, { next: Date.now() + (snapshot.state === "CLOSED" ? 300000 : 30000 + Math.random() * 5000), errors: 0 });
      await commit(() => store.update(target, snapshot));
    }).finally(() => inFlight.delete(id));
    fetches = work;
    inFlight.set(id, work);
    return work;
  };
  const tick = async () => {
    if (stopped) return;
    try {
      await commits.catch(() => {});
      const targets = new Map(store.active().map(s => [key(s), s]));
      for (const [id, target] of targets) {
        if (stopped) break;
        if (store.data.records[id]?.snapshot?.state === "MERGED") continue;
        if ((schedule.get(id)?.next ?? 0) <= Date.now()) await reconcile(target);
      }
      publish();
    } catch (error) { console.error(error); }
    finally { if (!stopped) timer = setTimeout(() => { void tick(); }, 1000); }
  };
  const resetDelivery = (consumer: string, target: Target) => {
    for (const client of clients.values()) if (client.consumer === consumer) client.sent.delete(key(target));
  };
  const handle = async (socket: Socket, message: Request & { version?: number }) => {
    await commits.catch(() => {});
    if (stopped) throw new Error("Watcher is shutting down");
    if (message.version !== protocolVersion) throw new Error("Incompatible watcher protocol");
    const consumer = message.consumer;
    if (message.op === "ping") return { version: protocolVersion, pid: process.pid, account: store.data.account, persistenceError };
    if (message.op === "stop") { setTimeout(() => { void cleanup().catch(console.error); }, 20); return { stopping: true }; }
    if (message.op === "list") return { records: store.data.records, subscriptions: store.active().filter(s => !consumer || s.consumer === consumer), persistenceError };
    if (message.op === "events") {
      if (!consumer) throw new Error("Consumer is required");
      clients.set(socket, { consumer, sent: new Map(), expired: new Set() });
      publish();
      return { listening: true };
    }
    const rawTarget = message.target;
    if (!rawTarget) throw new Error("Target is required");
    validateTarget(rawTarget);
    const target = { ...rawTarget, repo: rawTarget.repo.toLowerCase() };
    const status = () => {
      const record = store.data.records[key(target)];
      const subscription = consumer ? store.data.subscriptions[subscriptionKey(consumer, target)] : undefined;
      return record ? { ...record, stale: Boolean(record.error || persistenceError) || !record.fetchedAt || Date.now() - Date.parse(record.fetchedAt) > 90000, persistenceError, subscriptionActive: Boolean(subscription && subscription.expiresAt > Date.now()), subscription } : null;
    };
    if (message.op === "status") return status();
    if (message.op === "refresh") { await reconcile(target); return status(); }
    if (!consumer) throw new Error("Consumer is required");
    if (message.op === "watch") {
      const old = store.data.subscriptions[subscriptionKey(consumer, target)];
      if (!old || old.expiresAt <= Date.now()) resetDelivery(consumer, target);
      const subscription = await commit(() => store.register(consumer, target, message.leaseSeconds, message.worktree));
      if ((schedule.get(key(target))?.next ?? 0) <= Date.now()) void reconcile(target).catch(console.error);
      return subscription;
    }
    if (message.op === "cancel") {
      await commit(() => { delete store.data.subscriptions[subscriptionKey(consumer, target)]; });
      resetDelivery(consumer, target);
    } else if (message.op === "ack") await commit(() => store.acknowledge(consumer, target, message.revision!));
    else throw new Error("Unknown watcher operation");
    return { ok: true };
  };
  const server = createServer(socket => {
    sockets.add(socket);
    let buffer = "";
    let processing = Promise.resolve();
    socket.on("error", () => {});
    socket.on("close", () => { clients.delete(socket); sockets.delete(socket); });
    socket.on("data", chunk => {
      buffer += chunk.toString();
      if (buffer.length > 65536) return socket.destroy();
      let newline: number;
      while ((newline = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
        const work = processing.then(async () => {
          if (stopped || socket.destroyed) return;
          try { emit(socket, { result: await handle(socket, JSON.parse(line)) }); }
          catch (error) { emit(socket, { error: (error as Error).message }); }
        });
        processing = work;
        handlers.add(work);
        void work.finally(() => handlers.delete(work));
      }
    });
  });
  let shutdown: Promise<void> | undefined;
  const cleanup = (): Promise<void> => {
    if (shutdown) return shutdown;
    stopped = true;
    shutdown = (async () => {
      clearTimeout(timer);
      for (const socket of sockets) socket.destroy();
      try {
        if (server.listening) await new Promise<void>(resolve => server.close(() => resolve()));
        await Promise.allSettled([...handlers, ...inFlight.values(), commits]);
        if (loaded) await store.save();
      } finally {
        await unlink(socketPath()).catch(() => {});
        await unlink(lockPath).catch(() => {});
      }
    })();
    return shutdown;
  };
  try {
    await store.load();
    if (account && store.data.account && account !== store.data.account) throw new Error("Watcher state belongs to another GitHub account; use a separate PI_GITHUB_WATCH_DIR");
    if (account) store.data.account = account;
    loaded = true;
    await unlink(socketPath()).catch(error => { if (error.code !== "ENOENT") throw error; });
    await new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(socketPath(), resolve); });
    await chmod(socketPath(), 0o600);
    void tick();
    return cleanup;
  } catch (error) { await cleanup(); throw error; }
}

/** Capture credentials once so external gh auth switches cannot change a live daemon. */
export async function pinAuthentication(): Promise<string> {
  const { execFileSync } = await import("node:child_process");
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN ?? execFileSync("gh", ["auth", "token", "--hostname", "github.com"], { encoding: "utf8", timeout: 10000 }).trim();
  process.env.GH_TOKEN = token;
  process.env.GH_HOST = "github.com";
  const user = await ghJson(["api", "--hostname", "github.com", "user"]);
  return user.login;
}
