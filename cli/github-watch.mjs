#!/usr/bin/env node
import { createJiti } from "jiti";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const jiti = createJiti(import.meta.url);
const { request, listen } = await jiti.import("../lib/github-watch/client.ts");
const { runDaemon, pinAuthentication } = await jiti.import("../lib/github-watch/daemon.ts");
const [op = "help", subject, ...args] = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(`--${name}`); return index < 0 ? undefined : args[index + 1]; };
const consumer = option("consumer") ?? process.env.PI_ORCHESTRATOR_ID ?? "cli";
const target = subject && /^([^#]+)#(\d+)$/.exec(subject);
const parsed = target ? { repo: target[1], pr: Number(target[2]) } : undefined;
try {
  if (op === "daemon") {
    const account = await pinAuthentication();
    const stop = await runDaemon(undefined, account);
    console.error(`GitHub watcher running as ${account}`);
    let stopping = false;
    const shutdown = () => { if (!stopping) { stopping = true; void stop().then(() => process.exit(0)); } };
    process.on("SIGINT", shutdown); process.on("SIGTERM", shutdown);
  } else if (op === "start") {
    try { console.log(JSON.stringify(await request({ op: "ping" }))); }
    catch {
      const child = spawn(process.execPath, [fileURLToPath(import.meta.url), "daemon"], { detached: true, stdio: "ignore", env: process.env });
      child.unref();
      let result;
      for (let i = 0; i < 50; i++) {
        await new Promise(resolve => setTimeout(resolve, 100));
        try { result = await request({ op: "ping" }); break; } catch {}
      }
      if (!result) throw new Error("Daemon did not start; run github-watch daemon for diagnostics");
      console.log(JSON.stringify(result));
    }
  } else if (op === "stop") {
    console.log(JSON.stringify(await request({ op: "stop" })));
  } else if (op === "events") {
    const close = listen(consumer, event => console.log(JSON.stringify(event)), error => { console.error(error.message); process.exitCode = 1; }, target => console.log(JSON.stringify({ type: "expired", ...target })));
    process.on("SIGINT", () => { close(); }); process.on("SIGTERM", () => { close(); });
  } else if (["list", "status", "refresh", "watch", "cancel", "ack"].includes(op)) {
    if (op !== "list" && !parsed) throw new Error("Expected OWNER/REPO#PR");
    const message = { op, target: parsed, consumer };
    if (op === "watch") { message.leaseSeconds = Number(option("lease") ?? 14400); message.worktree = option("worktree"); }
    if (op === "ack") message.revision = Number(option("revision"));
    console.log(JSON.stringify(await request(message), null, 2));
  } else {
    console.log(`github-watch start | stop | daemon | list | events
 github-watch watch OWNER/REPO#PR [--consumer ID] [--worktree PATH] [--lease SECONDS]
 github-watch status|refresh|cancel OWNER/REPO#PR [--consumer ID]
 github-watch ack OWNER/REPO#PR --revision N [--consumer ID]
All output is JSON. events streams every subscribed PR for the consumer.`);
    if (op !== "help") process.exitCode = 1;
  }
} catch (error) { console.error(error.message); process.exitCode = 1; }
