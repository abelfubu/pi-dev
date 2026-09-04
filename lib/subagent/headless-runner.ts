import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import type { SubagentProfile, SubagentThinkingLevel } from "./types.js";

export interface SubagentUsage {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite: number;
	cost: number;
	turns: number;
	contextTokens: number;
}

export interface HeadlessSubagentResult {
	status: "completed" | "failed" | "aborted";
	output: string;
	model?: string;
	thinking?: SubagentThinkingLevel;
	usage: SubagentUsage;
	exitCode: number | null;
	error?: string;
	failureTranscript?: string;
	messages: unknown[];
}

export interface HeadlessSubagentProgress {
	output: string;
	model?: string;
	thinking?: SubagentThinkingLevel;
	usage: SubagentUsage;
}

interface RunHeadlessOptions {
	cwd: string;
	profile: SubagentProfile;
	model?: string;
	thinking?: SubagentThinkingLevel;
	files: string[];
	promptFile: string;
	signal?: AbortSignal;
	timeoutMs?: number;
	maxConcurrency: number;
	onUpdate?: (progress: HeadlessSubagentProgress) => void;
	piCommand?: { command: string; args?: string[] };
}

const emptyUsage = (): SubagentUsage => ({
	input: 0,
	output: 0,
	cacheRead: 0,
	cacheWrite: 0,
	cost: 0,
	turns: 0,
	contextTokens: 0,
});

function expandPath(path: string, cwd: string): string {
	const expanded = path === "~" ? homedir() : path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
	return resolve(cwd, expanded);
}

export function buildHeadlessArgs(options: Pick<RunHeadlessOptions, "cwd" | "profile" | "model" | "thinking" | "files" | "promptFile">): string[] {
	const { cwd, profile, model, thinking, files, promptFile } = options;
	const args = [
		"--mode", "json", "-p", "--no-session", "--approve",
		"--no-extensions", "--no-skills", "--no-prompt-templates",
	];
	if (model) args.push("--model", model);
	if (thinking) args.push("--thinking", thinking);
	for (const extension of profile.extensions ?? []) args.push("--extension", expandPath(extension, cwd));
	if (profile.tools) {
		const tools = profile.tools.filter((tool) => tool !== "subagent_notify");
		if (tools.length) args.push("--tools", tools.join(","));
	}
	if (profile.excludeTools?.length) args.push("--exclude-tools", profile.excludeTools.join(","));
	for (const skill of profile.skills ?? []) args.push("--skill", expandPath(skill, cwd));
	for (const template of profile.promptTemplates ?? []) args.push("--prompt-template", expandPath(template, cwd));
	for (const file of files) args.push(`@${file}`);
	args.push(`@${promptFile}`);
	return args;
}

function assistantText(message: unknown): string {
	if (!message || typeof message !== "object") return "";
	const candidate = message as { role?: unknown; content?: unknown };
	if (candidate.role !== "assistant" || !Array.isArray(candidate.content)) return "";
	return candidate.content
		.filter((part): part is { type: "text"; text: string } =>
			Boolean(part) && typeof part === "object" && (part as { type?: unknown }).type === "text"
			&& typeof (part as { text?: unknown }).text === "string")
		.map((part) => part.text)
		.join("\n")
		.trim();
}

export function truncateUtf8(text: string, maxBytes = 50 * 1024): string {
	const bytes = Buffer.byteLength(text, "utf8");
	if (bytes <= maxBytes) return text;
	let end = Math.min(text.length, maxBytes);
	while (end > 0) {
		const prefix = text.slice(0, end);
		const omitted = bytes - Buffer.byteLength(prefix, "utf8");
		const result = `${prefix}\n\n[Output truncated: ${omitted} bytes omitted.]`;
		if (Buffer.byteLength(result, "utf8") <= maxBytes) return result;
		end--;
	}
	return "";
}

interface Waiter { resolve: (release: () => void) => void; reject: (error: Error) => void; signal?: AbortSignal; onAbort?: () => void }
let activeRuns = 0;
const runQueue: Array<Waiter & { limit: number }> = [];
const writerStates = new Map<string, { active: boolean; queue: Waiter[] }>();

function abortedError(): Error {
	const error = new Error("Subagent aborted while waiting to run");
	error.name = "AbortError";
	return error;
}

function drainRuns(): void {
	for (let index = 0; index < runQueue.length;) {
		const waiter = runQueue[index];
		if (activeRuns >= waiter.limit) { index++; continue; }
		runQueue.splice(index, 1);
		waiter.signal?.removeEventListener("abort", waiter.onAbort!);
		activeRuns++;
		waiter.resolve(() => { activeRuns--; drainRuns(); });
	}
}

function acquireRun(limit: number, signal?: AbortSignal): Promise<() => void> {
	if (signal?.aborted) return Promise.reject(abortedError());
	if (activeRuns < limit) {
		activeRuns++;
		return Promise.resolve(() => { activeRuns--; drainRuns(); });
	}
	return new Promise((resolve, reject) => {
		const waiter: Waiter & { limit: number } = { resolve, reject, signal, limit };
		waiter.onAbort = () => {
			const index = runQueue.indexOf(waiter);
			if (index >= 0) runQueue.splice(index, 1);
			reject(abortedError());
		};
		signal?.addEventListener("abort", waiter.onAbort, { once: true });
		runQueue.push(waiter);
	});
}

function acquireWriter(cwd: string, signal?: AbortSignal): Promise<() => void> {
	if (signal?.aborted) return Promise.reject(abortedError());
	const state = writerStates.get(cwd) ?? { active: false, queue: [] };
	writerStates.set(cwd, state);
	if (!state.active) {
		state.active = true;
		return Promise.resolve(() => releaseWriter(cwd, state));
	}
	return new Promise((resolve, reject) => {
		const waiter: Waiter = { resolve, reject, signal };
		waiter.onAbort = () => {
			const index = state.queue.indexOf(waiter);
			if (index >= 0) state.queue.splice(index, 1);
			reject(abortedError());
		};
		signal?.addEventListener("abort", waiter.onAbort, { once: true });
		state.queue.push(waiter);
	});
}

function releaseWriter(cwd: string, state: { active: boolean; queue: Waiter[] }): void {
	const next = state.queue.shift();
	if (next) {
		next.signal?.removeEventListener("abort", next.onAbort!);
		next.resolve(() => releaseWriter(cwd, state));
		return;
	}
	state.active = false;
	writerStates.delete(cwd);
}

function getPiInvocation(override?: { command: string; args?: string[] }): { command: string; prefix: string[] } {
	if (override) return { command: override.command, prefix: override.args ?? [] };
	const currentScript = process.argv[1];
	if (currentScript && !currentScript.startsWith("/$bunfs/root/") && existsSync(currentScript)) {
		return { command: process.execPath, prefix: [currentScript] };
	}
	const executable = basename(process.execPath).toLowerCase();
	return /^(node|bun)(\.exe)?$/.test(executable)
		? { command: "pi", prefix: [] }
		: { command: process.execPath, prefix: [] };
}

async function persistFailureTranscript(raw: string, id: string): Promise<string> {
	const dir = join(homedir(), ".pi", "agent", "pi-dev", "subagent-runs");
	await mkdir(dir, { recursive: true });
	const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		if (!entry.isFile()) continue;
		const match = entry.name.match(/^(\d+)-/);
		if (match && Number(match[1]) < cutoff) await rm(join(dir, entry.name), { force: true });
	}
	const path = join(dir, `${Date.now()}-${id}.jsonl`);
	await writeFile(path, raw, "utf8");
	return path;
}

export async function runHeadlessSubagent(options: RunHeadlessOptions): Promise<HeadlessSubagentResult> {
	const writes = options.profile.tools?.some((tool) => tool === "edit" || tool === "write") ?? false;
	let releaseWriter: (() => void) | undefined;
	let releaseRun: (() => void) | undefined;
	try {
		if (writes) releaseWriter = await acquireWriter(options.cwd, options.signal);
		releaseRun = await acquireRun(Math.max(1, options.maxConcurrency), options.signal);
		const args = buildHeadlessArgs(options);
		const invocation = getPiInvocation(options.piCommand);
		const messages: unknown[] = [];
		const usage = emptyUsage();
		let finalOutput = "";
		let usedModel = options.model;
		let stopReason: string | undefined;
		let errorMessage: string | undefined;
		let stderr = "";
		let raw = "";
		let buffer = "";
		let aborted = false;
		let closed = false;

		const exitCode = await new Promise<number | null>((resolveExit) => {
			const child = spawn(invocation.command, [...invocation.prefix, ...args], {
				cwd: options.cwd,
				shell: false,
				stdio: ["ignore", "pipe", "pipe"],
			});
			let escalation: NodeJS.Timeout | undefined;
			const abort = () => {
				if (closed) return;
				aborted = true;
				child.kill("SIGTERM");
				escalation = setTimeout(() => { if (!closed) child.kill("SIGKILL"); }, 5_000);
			};
			const timeout = options.timeoutMs && options.timeoutMs > 0 ? setTimeout(abort, options.timeoutMs) : undefined;
			const processLine = (line: string) => {
				if (!line.trim()) return;
				let event: any;
				try { event = JSON.parse(line); } catch { return; }
				if (event.type !== "message_end" || !event.message) return;
				messages.push(event.message);
				if (event.message.role !== "assistant") return;
				usage.turns++;
				const currentUsage = event.message.usage;
				if (currentUsage) {
					usage.input += currentUsage.input ?? 0;
					usage.output += currentUsage.output ?? 0;
					usage.cacheRead += currentUsage.cacheRead ?? 0;
					usage.cacheWrite += currentUsage.cacheWrite ?? 0;
					usage.cost += currentUsage.cost?.total ?? 0;
					usage.contextTokens = currentUsage.totalTokens ?? usage.contextTokens;
				}
				finalOutput = assistantText(event.message) || finalOutput;
				if (event.message.model) {
					usedModel = event.message.provider ? `${event.message.provider}/${event.message.model}` : event.message.model;
				}
				stopReason = event.message.stopReason ?? stopReason;
				errorMessage = event.message.errorMessage ?? errorMessage;
				options.onUpdate?.({ output: finalOutput, model: usedModel, thinking: options.thinking, usage: { ...usage } });
			};
			child.stdout.on("data", (chunk) => {
				const text = chunk.toString();
				raw += text;
				buffer += text;
				let newline: number;
				while ((newline = buffer.indexOf("\n")) >= 0) {
					processLine(buffer.slice(0, newline));
					buffer = buffer.slice(newline + 1);
				}
			});
			child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
			child.on("error", (error) => { errorMessage = error.message; });
			child.on("close", (code) => {
				closed = true;
				if (buffer.trim()) processLine(buffer);
				if (timeout) clearTimeout(timeout);
				if (escalation) clearTimeout(escalation);
				options.signal?.removeEventListener("abort", abort);
				resolveExit(code);
			});
			if (options.signal?.aborted) abort();
			else options.signal?.addEventListener("abort", abort, { once: true });
		});

		const failed = exitCode !== 0 || stopReason === "error" || stopReason === "aborted" || !finalOutput;
		const status = aborted || stopReason === "aborted" ? "aborted" : failed ? "failed" : "completed";
		const error = status === "completed" ? undefined : errorMessage || stderr.trim() || (!finalOutput ? "Subagent produced no final assistant text." : `Subagent exited with code ${exitCode}.`);
		let failureTranscript: string | undefined;
		if (status !== "completed") {
			try {
				failureTranscript = await persistFailureTranscript(
					raw + (stderr ? `\n{"stderr":${JSON.stringify(stderr)}}\n` : ""),
					basename(dirname(options.promptFile)),
				);
			} catch {
				// Diagnostics persistence is best-effort; preserve the original result.
			}
		}
		return { status, output: finalOutput, model: usedModel, thinking: options.thinking, usage, exitCode, error, failureTranscript, messages };
	} catch (error) {
		return {
			status: error instanceof Error && error.name === "AbortError" ? "aborted" : "failed",
			output: "",
			model: options.model,
			thinking: options.thinking,
			usage: emptyUsage(),
			exitCode: null,
			error: error instanceof Error ? error.message : String(error),
			messages: [],
		};
	} finally {
		releaseRun?.();
		releaseWriter?.();
	}
}
