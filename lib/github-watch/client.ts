import { connect } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Target } from "./state.js";

export const protocolVersion = 1;
export function watchDirectory(): string { return process.env.PI_GITHUB_WATCH_DIR ?? join(homedir(), ".pi", "github-watch"); }
export function socketPath(): string { return join(watchDirectory(), "watch.sock"); }
export interface Request { op: string; consumer?: string; target?: Target; revision?: number; leaseSeconds?: number; worktree?: string }
export interface Change extends Target { type: "changed"; revision: number; worktree?: string }
export function request(message: Request): Promise<any> {
  return new Promise((resolve, reject) => {
    const socket = connect(socketPath());
    let buffer = "";
    let settled = false;
    const timeout = setTimeout(() => socket.destroy(new Error("Watcher request timed out")), 120000);
    const finish = () => clearTimeout(timeout);
    socket.on("error", reject);
    socket.on("close", () => { finish(); if (!settled) reject(new Error("Watcher closed before responding")); });
    socket.on("connect", () => socket.write(JSON.stringify({ ...message, version: protocolVersion }) + "\n"));
    socket.on("data", chunk => {
      buffer += chunk.toString();
      if (buffer.length > 32 * 1024 * 1024) return socket.destroy(new Error("Watcher response too large"));
      const newline = buffer.indexOf("\n");
      if (newline < 0) return;
      try {
        const response = JSON.parse(buffer.slice(0, newline));
        settled = true;
        socket.end();
        if (response.error) reject(new Error(response.error)); else resolve(response.result);
      } catch (error) { reject(error); socket.destroy(); }
    });
  });
}
export function listen(consumer: string, onChange: (change: Change) => void, onError: (error: Error) => void, onExpired?: (target: Target) => void): () => void {
  const socket = connect(socketPath());
  let buffer = "";
  let closed = false;
  socket.on("connect", () => socket.write(JSON.stringify({ version: protocolVersion, op: "events", consumer }) + "\n"));
  socket.on("data", chunk => {
    buffer += chunk.toString();
    if (buffer.length > 1024 * 1024) return socket.destroy(new Error("Watcher event buffer too large"));
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1);
      try {
        const event = JSON.parse(line);
        if (event.error) throw new Error(event.error);
        if (event.type === "changed") onChange(event);
        if (event.type === "expired") onExpired?.(event);
      } catch (error) { socket.destroy(error as Error); return; }
    }
  });
  socket.on("error", () => {});
  socket.on("close", () => { if (!closed) onError(new Error("Watcher event connection closed")); });
  return () => { closed = true; socket.destroy(); };
}
