import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync, rmSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import * as net from "node:net";
import { randomUUID } from "node:crypto";
import { homedir, tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";
import { loadConfig, type PiDevConfig } from "../lib/config.js";
import { closeHerdrPane, closeHerdrTab, createHerdrPane, notifyPane, runInPane, shellQuote } from "../lib/herdr.js";

function textContent(text: string): { type: "text"; text: string } {
	return { type: "text", text };
}

interface SubagentDetails {
	missing?: string[];
	profile?: string;
	pane?: string;
	tab?: string;
	resultFile?: string;
	launchId?: string;
	socketError?: string;
}

interface SubagentProfile {
	name: string;
	layout?: "tab" | "pane";
	model?: string;
	tools?: string[];
	excludeTools?: string[];
	skills?: string[];
	promptTemplates?: string[];
}

interface ImplementationPlan {
	intent: string;
	modifications: string[];
	additions: string[];
}

// Resolve the repo-local check and tdd skills so the coder profile keeps its
// workflow guidance even when skill discovery is disabled. Omitted when not installed.
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CODER_SKILLS = [join(REPO_ROOT, "skills", "check")].filter(existsSync).concat("tdd");

const READ_ONLY_TOOLS = ["read", "bash", "grep", "find", "ls", "subagent_notify"];
const CODER_TOOLS = [
	"read",
	"bash",
	"edit",
	"write",
	"grep",
	"find",
	"ls",
	"code_check",
	"code_check_list",
	"subagent_notify",
];

const DEFAULT_SUBAGENT_PROFILES: Record<string, SubagentProfile> = {
	reviewer: {
		name: "reviewer",
		layout: "tab",
		tools: READ_ONLY_TOOLS,
		skills: [],
		promptTemplates: [],
	},
	coder: {
		name: "coder",
		layout: "tab",
		tools: CODER_TOOLS,
		skills: CODER_SKILLS,
		promptTemplates: [],
	},
	scout: {
		name: "scout",
		layout: "tab",
		tools: READ_ONLY_TOOLS,
		skills: [],
		promptTemplates: [],
	},
	minimal: {
		name: "minimal",
		layout: "pane",
		tools: ["bash", "read", "subagent_notify"],
		skills: [],
		promptTemplates: [],
	},
};

async function loadSubagentProfiles(cwd: string): Promise<Record<string, SubagentProfile>> {
	const config = await loadConfig(cwd).catch(() => ({} as PiDevConfig));
	const defaults: SubagentProfile = {
		name: "",
		layout: config.subagentDefaults?.layout,
		model: config.subagentDefaults?.model,
	};

	const profiles: Record<string, SubagentProfile> = { ...DEFAULT_SUBAGENT_PROFILES };
	for (const [key, profile] of Object.entries(profiles)) {
		profiles[key] = mergeProfiles(defaults, profile);
	}

	if (config.subagents) {
		for (const [key, profileConfig] of Object.entries(config.subagents)) {
			const base = profiles[key] ?? mergeProfiles(defaults, { name: profileConfig.name ?? key });
			profiles[key] = mergeProfiles(base, {
				name: profileConfig.name,
				layout: profileConfig.layout,
				model: profileConfig.model,
				tools: profileConfig.tools,
				excludeTools: profileConfig.excludeTools,
				skills: profileConfig.skills,
				promptTemplates: profileConfig.promptTemplates,
			});
		}
	}

	return profiles;
}

function mergeProfiles(base: SubagentProfile, override: Partial<SubagentProfile>): SubagentProfile {
	return {
		name: override.name ?? base.name,
		layout: override.layout ?? base.layout,
		model: override.model ?? base.model,
		tools: override.tools ?? base.tools,
		excludeTools: override.excludeTools ?? base.excludeTools,
		skills: override.skills ?? base.skills,
		promptTemplates: override.promptTemplates ?? base.promptTemplates,
	};
}

export function resolveSubagentModel(explicitModel?: string, profileModel?: string): string | undefined {
	return explicitModel?.trim() || profileModel?.trim() || undefined;
}

export function buildPiLaunchArgs(model?: string): string[] {
	return ["--approve", ...(model ? ["--model", model] : [])];
}

/** Build a disk-backed Pi invocation so Herdr only injects a short command. */
function buildPiLaunchScript(params: {
	cwd: string;
	env: Record<string, string>;
	args: string[];
}): string {
	const lines = [
		"#!/usr/bin/env bash",
		"set -euo pipefail",
		"",
		`cd ${shellQuote(params.cwd)}`,
	];
	for (const [name, value] of Object.entries(params.env)) {
		lines.push(`export ${name}=${shellQuote(value)}`);
	}
	lines.push("", "exec pi \\");
	params.args.forEach((arg, index) => {
		lines.push(`  ${shellQuote(arg)}${index < params.args.length - 1 ? " \\" : ""}`);
	});
	return `${lines.join("\n")}\n`;
}

/** Expand a leading `~` and resolve relative paths against the subagent cwd. */
function expandConfigPath(path: string, cwd: string): string {
	const expanded = path === "~" ? homedir() : path.startsWith("~/") ? join(homedir(), path.slice(2)) : path;
	return resolve(cwd, expanded);
}

/** Build the `pi` CLI argument list for a subagent session. */
function buildPiArgs(params: {
	profile: SubagentProfile;
	model?: string;
	files: string[];
	promptFile: string;
	cwd: string;
}): string[] {
	const { profile, model, files, promptFile, cwd } = params;
	const args = buildPiLaunchArgs(model);
	if (profile.tools) {
		const tools = profile.tools.includes("subagent_notify")
			? profile.tools
			: [...profile.tools, "subagent_notify"];
		args.push("--tools", tools.join(","));
	}
	if (profile.excludeTools?.length) {
		args.push("--exclude-tools", profile.excludeTools.join(","));
	}
	if (profile.skills) {
		args.push("--no-skills");
		for (const skill of profile.skills) {
			args.push("--skill", expandConfigPath(skill, cwd));
		}
	}
	if (profile.promptTemplates) {
		args.push("--no-prompt-templates");
		for (const template of profile.promptTemplates) {
			args.push("--prompt-template", expandConfigPath(template, cwd));
		}
	}
	for (const file of files) {
		args.push(`@${file}`);
	}
	args.push(`@${promptFile}`);
	return args;
}

function errorResult(message: string, details: SubagentDetails = {}) {
	return {
		content: [textContent(message)],
		isError: true as const,
		details,
	};
}

let notifySocketPromise: Promise<string | null> | null = null;
let notifySocketServer: net.Server | null = null;
let notifySocketDir: string | null = null;
let notifySocketPath: string | null = null;
let subagentCompletionSent = false;
const completedLaunches = new Set<string>();

function ensureNotifySocket(pi?: ExtensionAPI): Promise<string | null> {
	if (notifySocketPromise && notifySocketPath && existsSync(notifySocketPath)) {
		return notifySocketPromise;
	}
	notifySocketPromise = createNotifySocket(pi);
	return notifySocketPromise;
}

async function createNotifySocket(pi?: ExtensionAPI): Promise<string | null> {
	if (process.env.SUBAGENT_NOTIFY_SOCKET) return null;

	try {
		const socketDir = await mkdtemp(join(tmpdir(), "pi-subagent-"));
		notifySocketDir = socketDir;
		const socketPath = join(socketDir, "notify.sock");

		try {
			existsSync(socketPath) && rmSync(socketPath);
		} catch { }

		const server = net.createServer((conn) => {
			let buffer = "";
			conn.on("data", (data) => {
				buffer += data.toString();
				let idx: number;
				while ((idx = buffer.indexOf("\n")) !== -1) {
					const line = buffer.slice(0, idx).trim();
					buffer = buffer.slice(idx + 1);
					if (!line) continue;
					handleNotifyMessage(conn, line, pi);
				}
			});
			conn.on("error", () => { });
		});

		await new Promise<void>((resolve, reject) => {
			server.listen(socketPath, () => resolve());
			server.on("error", (err) => reject(err));
		});

		notifySocketServer = server;
		notifySocketPath = socketPath;

		const cleanup = () => {
			try {
				server.close();
			} catch { }
			try {
				notifySocketDir && rmSync(notifySocketDir, { recursive: true, force: true });
			} catch { }
			notifySocketServer = null;
			notifySocketPath = null;
		};

		pi?.on("session_shutdown", cleanup);
		process.on("exit", cleanup);

		return socketPath;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`Subagent notify socket failed: ${message}`);
		return null;
	}
}

function isDuplicateCompletion(launchId: string | undefined, completed = completedLaunches): boolean {
	if (!launchId) return false;
	if (completed.has(launchId)) return true;
	completed.add(launchId);
	return false;
}

let autoClosePanePromise: Promise<boolean> | null = null;

function shouldAutoClosePane(): Promise<boolean> {
	if (!autoClosePanePromise) {
		autoClosePanePromise = loadConfig(process.cwd())
			.then((config) => config.subagentDefaults?.autoClosePane !== false)
			.catch(() => true);
	}
	return autoClosePanePromise;
}

async function closeSubagentPane(paneId: unknown) {
	if (typeof paneId !== "string" || !paneId) return;
	if (!(await shouldAutoClosePane())) return;
	try {
		await closeHerdrPane(paneId);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		console.error(`Subagent pane auto-close failed: ${message}`);
	}
}

function handleNotifyMessage(conn: net.Socket, raw: string, pi?: ExtensionAPI) {
	try {
		const msg = JSON.parse(raw);
		if ((msg.type === "done" || msg.type === "failed") && pi) {
			const launchId = typeof msg.launchId === "string" ? msg.launchId : undefined;
			if (isDuplicateCompletion(launchId)) {
				respond(conn, { ok: true, duplicate: true });
				return;
			}

			const resultFile = msg.resultFile ?? "unknown";
			const summary = msg.summary ?? msg.type;
			pi.sendUserMessage(
				`Subagent ${msg.type}: ${resultFile} (${summary})`,
				{ deliverAs: "followUp" },
			);
			respond(conn, { ok: true });
			if (msg.type === "done") {
				// Best-effort cleanup; keep failed panes open for inspection.
				void closeSubagentPane(msg.paneId);
			}
		} else {
			respond(conn, { ok: false, error: `Unknown message type: ${msg.type}` });
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		respond(conn, { ok: false, error: message });
	}
}

function respond(conn: net.Socket, obj: unknown) {
	try {
		conn.end(JSON.stringify(obj) + "\n");
	} catch {
		conn.end();
	}
}

function sendNotifyMessage(socketPath: string, message: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const conn = net.createConnection(socketPath);
		let response = "";
		let settled = false;

		const timeout = setTimeout(() => {
			if (settled) return;
			settled = true;
			conn.destroy();
			reject(new Error("Notify socket timeout"));
		}, 5000);

		conn.on("connect", () => {
			conn.write(message + "\n");
		});

		conn.on("data", (data) => {
			response += data.toString();
		});

		conn.on("end", () => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			try {
				const parsed = JSON.parse(response.trim().split("\n")[0] ?? "{}");
				if (parsed.ok === false) {
					reject(new Error(parsed.error ?? "Notify failed"));
				} else {
					resolve();
				}
			} catch {
				resolve();
			}
		});

		conn.on("error", (err) => {
			if (settled) return;
			settled = true;
			clearTimeout(timeout);
			reject(err);
		});
	});
}

function assistantMessageText(message: unknown): string | undefined {
	if (!message || typeof message !== "object") return undefined;
	const candidate = message as { role?: unknown; content?: unknown };
	if (candidate.role !== "assistant") return undefined;
	if (typeof candidate.content === "string") return candidate.content.trim() || undefined;
	if (!Array.isArray(candidate.content)) return undefined;

	const text = candidate.content
		.filter((part): part is { type: "text"; text: string } =>
			Boolean(part) && typeof part === "object"
			&& (part as { type?: unknown }).type === "text"
			&& typeof (part as { text?: unknown }).text === "string")
		.map((part) => part.text)
		.join("\n")
		.trim();
	return text || undefined;
}

function latestAssistantText(ctx: { sessionManager?: { getBranch(): unknown[] } }): string | undefined {
	const branch = ctx.sessionManager?.getBranch() ?? [];
	for (let index = branch.length - 1; index >= 0; index--) {
		const entry = branch[index] as { type?: unknown; message?: unknown } | undefined;
		const text = assistantMessageText(entry?.type === "message" ? entry.message : entry);
		if (text) return text;
	}
	return undefined;
}

async function ensureResultArtifact(resultFile: string, fallback: string): Promise<boolean> {
	try {
		if ((await readFile(resultFile, "utf8")).trim()) return false;
	} catch (err) {
		const code = (err as NodeJS.ErrnoException).code;
		if (code !== "ENOENT") throw err;
	}
	await writeFile(resultFile, `${fallback.trim()}\n`, "utf8");
	return true;
}

function completionSummary(text: string | undefined, fallback: string): string {
	const firstLine = text?.split("\n").map((line) => line.trim()).find(Boolean);
	return sanitizeLabel(firstLine ?? fallback, 160);
}

async function notifySubagentParent(params: {
	type: "done" | "failed";
	resultFile: string;
	launchId?: string;
	paneId?: string;
	summary: string;
	parentPaneId?: string;
	socketPath?: string;
}): Promise<{ transport: "socket" | "herdr"; socketError?: string }> {
	const message = JSON.stringify({
		type: params.type,
		resultFile: params.resultFile,
		launchId: params.launchId,
		paneId: params.paneId,
		summary: params.summary,
	});

	if (params.socketPath) {
		try {
			await sendNotifyMessage(params.socketPath, message);
			return { transport: "socket" };
		} catch (err) {
			const socketError = err instanceof Error ? err.message : String(err);
			if (!params.parentPaneId) throw new Error(`Socket notify failed and no Herdr parent pane id: ${socketError}`);
			await notifyPane(params.parentPaneId, `subagent ${params.type}: ${params.resultFile} (${params.summary})`);
			return { transport: "herdr", socketError };
		}
	}

	if (!params.parentPaneId) {
		throw new Error("Missing parent pane id and notify socket.");
	}
	await notifyPane(params.parentPaneId, `subagent ${params.type}: ${params.resultFile} (${params.summary})`);
	return { transport: "herdr" };
}

function buildSubagentPrompt(params: {
	task: string;
	profile: string;
	implementationPlan?: ImplementationPlan;
	parentPaneId: string;
	resultFile: string;
	launchId: string;
}): string {
	const plan = params.implementationPlan;
	const planSection = plan
		? [
			`## Implementation plan`,
			``,
			`### Intent`,
			plan.intent,
			``,
			`### Modifications`,
			...(plan.modifications.length ? plan.modifications.map((item) => `- ${item}`) : [`- None`]),
			``,
			`### Additions`,
			...(plan.additions.length ? plan.additions.map((item) => `- ${item}`) : [`- None`]),
			``,
		]
		: [];
	return [
		...planSection,
		`## Task`,
		params.task,
		``,
		`## Subagent context`,
		`- Profile: ${params.profile}`,
		`- Parent pane: ${params.parentPaneId}`,
		`- Result file: ${params.resultFile}`,
		`- Launch ID: ${params.launchId}`,
		`- Environment variables: SUBAGENT_PARENT_PANE_ID, SUBAGENT_RESULT_FILE, SUBAGENT_LAUNCH_ID, SUBAGENT_NOTIFY_SOCKET`,
		``,
		`When you finish, write your final result to the result file, then call the subagent_notify tool with:`,
		`- type: done`,
		`- result_file: ${params.resultFile}`,
		`- launch_id: ${params.launchId}`,
		`- summary: a one-line summary of what you found or did`,
		`The harness also sends a fallback notification after you settle, so never continue working after reporting completion.`,
	].join("\n");
}

const SubagentParams = Type.Object({
	profile: Type.String({
		description: "Subagent profile name. Profiles are configured in ~/.pi/agent/pi-dev.json under the subagents key; built-in profiles are reviewer, coder, scout, and minimal.",
	}),
	task: Type.String({
		description: "Markdown task for the subagent",
	}),
	implementationPlan: Type.Optional(
		Type.Object({
			intent: Type.String({ description: "Why the change exists and what behavior it should produce" }),
			modifications: Type.Array(Type.String(), {
				description: "Existing files and interfaces/functions/symbols to modify, with the intended change",
			}),
			additions: Type.Array(Type.String(), {
				description: "Files and interfaces/functions/symbols to add, with their purpose",
			}),
		}, { description: "Required for the coder profile; rendered before the task" }),
	),
	title: Type.Optional(
		Type.String({
			description: "Optional descriptive title for the Herdr pane or tab. If omitted, a title is derived from the task, profile, and working directory.",
		}),
	),
	files: Type.Optional(
		Type.Array(Type.String(), {
			description: "Files to attach with @file references (resolved relative to cwd)",
		}),
	),
	cwd: Type.Optional(
		Type.String({
			description: "Working directory for the subagent; defaults to the current cwd",
		}),
	),
	model: Type.Optional(
		Type.String({
			description: "Optional model/provider to pass to pi with --model",
		}),
	),
});

const SubagentNotifyParams = Type.Object({
	type: Type.Optional(
		Type.String({
			description: "Notification type, e.g. done",
		}),
	),
	parent_pane_id: Type.Optional(
		Type.String({
			description:
				"Herdr pane ID of the parent session; falls back to SUBAGENT_PARENT_PANE_ID env var",
		}),
	),
	result_file: Type.Optional(
		Type.String({
			description:
				"Absolute path to the result file the subagent wrote; falls back to SUBAGENT_RESULT_FILE env var",
		}),
	),
	launch_id: Type.Optional(
		Type.String({
			description:
				"Unique subagent launch ID; falls back to SUBAGENT_LAUNCH_ID env var",
		}),
	),
	summary: Type.Optional(
		Type.String({
			description: "One-line summary of the result",
		}),
	),
});

const MAX_SUBAGENT_LABEL_LENGTH = 32;

function sanitizeLabel(label: string, maxLength = MAX_SUBAGENT_LABEL_LENGTH): string {
	const cleaned = label.replace(/\s+/g, " ").trim();
	if (cleaned.length <= maxLength) return cleaned;
	if (maxLength <= 1) return maxLength === 1 ? "…" : "";
	return `${cleaned.slice(0, maxLength - 1).trimEnd()}…`;
}

function extractJiraIssueKey(text: string): string | undefined {
	const match = text.match(/\b([A-Z][A-Z0-9]+-\d+)\b/);
	return match?.[1];
}

function taskHeadline(task: string, maxLength = 40): string | undefined {
	const line = task
		.split("\n")
		.map((line) => line.replace(/^#{1,6}\s*/, "").trim())
		.find((line) => line.length > 0);
	if (!line) return undefined;
	const cleaned = line.replace(/`/g, "").replace(/\s+/g, " ").trim();
	if (cleaned.length === 0) return undefined;
	if (cleaned.length <= maxLength) return cleaned;
	return cleaned.slice(0, maxLength).trimEnd() + "…";
}

function folderName(cwd: string): string | undefined {
	const base = basename(cwd);
	if (base === basename(process.cwd())) return undefined;
	return base;
}

function buildSubagentLabel(params: {
	title?: string;
	profile: string;
	task: string;
	cwd: string;
}): string {
	if (params.title) {
		return sanitizeLabel(params.title);
	}

	const issueKey = extractJiraIssueKey(params.task);
	let headline = taskHeadline(params.task);
	const folder = folderName(params.cwd);

	if (issueKey && headline?.toLowerCase().startsWith(`${issueKey.toLowerCase()}:`)) {
		headline = headline.slice(issueKey.length + 1).trim();
	}

	const prefix = issueKey ? `${issueKey} ` : "";
	const context = folder ? `${params.profile}/${folder}` : params.profile;
	const suffix = ` [${context}]`;
	const headlineLength = MAX_SUBAGENT_LABEL_LENGTH - prefix.length - suffix.length;
	const shortHeadline = headline ? sanitizeLabel(headline, headlineLength) : "";

	return sanitizeLabel(`${prefix}${shortHeadline}${suffix}`);
}

async function executeSubagent(
	_id: string,
	params: {
		profile: string;
		task: string;
		implementationPlan?: ImplementationPlan;
		title?: string;
		files?: string[];
		cwd?: string;
		model?: string;
	},
	_signal: AbortSignal | undefined,
	_onUpdate: unknown,
	ctx: { cwd?: string },
) {
	try {
		const cwd = resolve(params.cwd ?? ctx?.cwd ?? process.cwd());
		const profiles = await loadSubagentProfiles(cwd);
		const profile = profiles[params.profile];
		if (!profile) {
			return errorResult(
				`Unknown profile: ${params.profile}. Available: ${Object.keys(profiles).join(", ")}.`,
			);
		}

		if (params.profile === "coder" && !params.implementationPlan) {
			return errorResult("The coder profile requires an implementationPlan with intent, modifications, and additions.");
		}

		const files = (params.files ?? []).map((f) => resolve(cwd, f));
		const missing = files.filter((f) => !existsSync(f));
		if (missing.length > 0) {
			return errorResult(`Missing files: ${missing.join(", ")}`, { missing });
		}

		if (!profile.layout) {
			return errorResult(`Profile ${params.profile} is missing layout.`);
		}
		const layout = profile.layout;

		const resultDir = await mkdtemp(join(tmpdir(), "pi-subagent-"));
		const resultFile = resolve(
			resultDir,
			`${profile.name}-result.md`,
		);
		const launchId = randomUUID();

		const parentPaneId = process.env.HERDR_PANE_ID;
		const parentWorkspaceId = process.env.HERDR_WORKSPACE_ID;
		if (!parentPaneId || !parentWorkspaceId) {
			return errorResult("Missing parent Herdr pane or workspace context.");
		}

		const promptFile = resolve(resultDir, "prompt.md");
		await writeFile(
			promptFile,
			buildSubagentPrompt({
				task: params.task,
				profile: profile.name,
				implementationPlan: params.implementationPlan,
				parentPaneId,
				resultFile,
				launchId,
			}),
			"utf8",
		);

		const socketPath = await ensureNotifySocket();

		const label = buildSubagentLabel({
			title: params.title,
			profile: profile.name,
			task: params.task,
			cwd,
		});

		const container = await createHerdrPane(layout, label, cwd, {
			paneId: parentPaneId,
			workspaceId: parentWorkspaceId,
		});
		if (!container.paneId) {
			throw new Error("herdr did not return a pane id");
		}

		const piArgs = buildPiArgs({
			profile,
			model: resolveSubagentModel(params.model, profile.model),
			files,
			promptFile,
			cwd,
		});

		const launchFile = resolve(resultDir, "launch.sh");
		await writeFile(launchFile, buildPiLaunchScript({
			cwd,
			env: {
				SUBAGENT_PARENT_PANE_ID: parentPaneId,
				SUBAGENT_RESULT_FILE: resultFile,
				SUBAGENT_LAUNCH_ID: launchId,
				...(socketPath ? { SUBAGENT_NOTIFY_SOCKET: socketPath } : {}),
			},
			args: piArgs,
		}), "utf8");
		await runInPane(container.paneId, `bash ${shellQuote(launchFile)}`);

		return {
			content: [
				textContent(container.tabId
					? `Subagent **${profile.name}** launched in tab **${container.tabId}** (${label}). Result will be written to ${resultFile}; it will call \`subagent_notify\` when done.`
					: `Subagent **${profile.name}** launched in pane **${container.paneId}** (${label}). Result will be written to ${resultFile}; it will call \`subagent_notify\` when done.`),
			],
			details: { profile: profile.name, workspace: parentWorkspaceId, pane: container.paneId, tab: container.tabId, resultFile, promptFile, launchFile, socketPath, launchId },
		};
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return errorResult(message);
	}
}

export default function (pi: ExtensionAPI) {
	// Reset socket state on reload. If the module is cached, the old socket may
	// have been cleaned up; always recreate a fresh one.
	if (notifySocketServer) {
		try {
			notifySocketServer.close();
		} catch { }
		notifySocketServer = null;
	}
	if (notifySocketDir) {
		try {
			rmSync(notifySocketDir, { recursive: true, force: true });
		} catch { }
		notifySocketDir = null;
	}
	notifySocketPath = null;
	notifySocketPromise = null;
	autoClosePanePromise = null;
	subagentCompletionSent = false;
	completedLaunches.clear();

	if (process.env.HERDR_ENV !== "1") {
		return;
	}

	// Start the notify socket server if we are the parent (not a subagent).
	if (!process.env.SUBAGENT_NOTIFY_SOCKET) {
		ensureNotifySocket(pi);
	}

	const subagentResultFile = process.env.SUBAGENT_RESULT_FILE;
	if (subagentResultFile) {
		// agent_settled was added after the oldest supported peer type definitions.
		// Keep the runtime hook while remaining source-compatible with those definitions.
		const onAgentSettled = pi.on as unknown as (
			event: "agent_settled",
			handler: (
				event: unknown,
				ctx: { sessionManager: { getBranch(): unknown[] } },
			) => Promise<void>,
		) => void;
		onAgentSettled("agent_settled", async (_event, ctx) => {
			if (subagentCompletionSent) return;
			const finalText = latestAssistantText(ctx);
			const fallback = finalText ?? "Subagent settled without a textual final response.";
			try {
				await ensureResultArtifact(subagentResultFile, fallback);
				await notifySubagentParent({
					type: "done",
					resultFile: subagentResultFile,
					launchId: process.env.SUBAGENT_LAUNCH_ID,
					paneId: process.env.HERDR_PANE_ID,
					summary: completionSummary(finalText, "Subagent completed"),
					parentPaneId: process.env.SUBAGENT_PARENT_PANE_ID,
					socketPath: process.env.SUBAGENT_NOTIFY_SOCKET,
				});
				subagentCompletionSent = true;
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error(`Automatic subagent completion failed: ${message}`);
			}
		});

		pi.on("session_shutdown", async (event, ctx) => {
			if (subagentCompletionSent || event.reason !== "quit") return;
			const finalText = latestAssistantText(ctx);
			const fallback = finalText ?? "Subagent exited before reaching a settled completion state.";
			try {
				await ensureResultArtifact(subagentResultFile, fallback);
				await notifySubagentParent({
					type: "failed",
					resultFile: subagentResultFile,
					launchId: process.env.SUBAGENT_LAUNCH_ID,
					summary: "Subagent exited before completing",
					parentPaneId: process.env.SUBAGENT_PARENT_PANE_ID,
					socketPath: process.env.SUBAGENT_NOTIFY_SOCKET,
				});
				subagentCompletionSent = true;
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				console.error(`Subagent shutdown notification failed: ${message}`);
			}
		});
	}

	pi.registerTool({
		name: "herdr_handoff",
		label: "Herdr Handoff",
		description:
			"Open a new focused Herdr tab in the current workspace, start a fresh interactive pi session, and seed it with a prompt. Use when the user wants to hand off a slice of work to a separate interactive session, especially when they say things like 'hand off', 'new tab', or 'work on this in a fresh pi'.",
		parameters: Type.Object({
			title: Type.String({ description: "Title for the new Herdr tab" }),
			prompt: Type.String({
				description:
					"Markdown prompt to seed as the first input in the new pi session",
			}),
			files: Type.Optional(
				Type.Array(Type.String(), {
					description:
						"Optional files to attach with @file references (resolved relative to cwd)",
				}),
			),
			cwd: Type.Optional(
				Type.String({
					description:
						"Working directory for the new pi session; defaults to the current cwd",
				}),
			),
			model: Type.Optional(
				Type.String({
					description: "Optional model/provider to pass to pi with --model",
				}),
			),
		}),
		async execute(_id, params, _signal, _onUpdate, ctx) {
			try {
				const cwd = resolve(
					params.cwd ??
					(ctx?.cwd as string | undefined) ??
					process.cwd(),
				);

				const files = (params.files ?? []).map((f) => resolve(cwd, f));
				const missing = files.filter((f) => !existsSync(f));
				if (missing.length > 0) {
					return {
						content: [
							textContent(`Missing files: ${missing.join(", ")}`),
						],
						isError: true,
						details: { missing },
					};
				}

				const parentPaneId = process.env.HERDR_PANE_ID;
				const parentWorkspaceId = process.env.HERDR_WORKSPACE_ID;
				const parent = parentPaneId && parentWorkspaceId
					? { paneId: parentPaneId, workspaceId: parentWorkspaceId }
					: undefined;
				const container = await createHerdrPane("tab", params.title, cwd, parent);
				if (!container.paneId || !container.tabId) {
					throw new Error(
						`herdr tab create did not return tab/pane ids: ${JSON.stringify(container)}`,
					);
				}

				const promptDir = await mkdtemp(join(tmpdir(), "pi-handoff-"));
				const promptFile = resolve(promptDir, "prompt.md");
				await writeFile(promptFile, params.prompt, "utf8");

				const piArgs = buildPiLaunchArgs(params.model);
				for (const file of files) {
					piArgs.push(`@${file}`);
				}
				piArgs.push(`@${promptFile}`);

				const launchFile = resolve(promptDir, "launch.sh");
				await writeFile(launchFile, buildPiLaunchScript({ cwd, env: {}, args: piArgs }), "utf8");
				await runInPane(container.paneId, `bash ${shellQuote(launchFile)}`);

				return {
					content: [
						textContent(`Handed off to tab **${container.tabId}** (${params.title})`),
					],
					details: {
						tab: container.tabId,
						pane: container.paneId,
						title: params.title,
					},
				};
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return {
					content: [textContent(message)],
					isError: true,
					details: {},
				};
			}
		},
	});

	pi.registerTool({
		name: "herdr_close",
		label: "Herdr Close",
		description:
			"Close a Herdr pane or tab when it is no longer needed. Provide either pane or tab, not both.",
		parameters: Type.Object({
			pane: Type.Optional(
				Type.String({
					description: "Herdr pane ID to close",
				}),
			),
			tab: Type.Optional(
				Type.String({
					description: "Herdr tab ID to close",
				}),
			),
		}),
		async execute(_id, params) {
			try {
				if (params.pane && params.tab) {
					return errorResult("Provide either pane or tab, not both.");
				}
				if (params.pane) {
					await closeHerdrPane(params.pane);
					return {
						content: [textContent(`Closed pane **${params.pane}**.`)],
						details: {},
					};
				}
				if (params.tab) {
					await closeHerdrTab(params.tab);
					return {
						content: [textContent(`Closed tab **${params.tab}**.`)],
						details: {},
					};
				}
				return errorResult("Provide either pane or tab.");
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return {
					content: [textContent(message)],
					isError: true,
					details: {},
				};
			}
		},
	});

	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description:
			"Launch a specialized subagent in a new Herdr tab or pane. Profiles can be defined in ~/.pi/agent/pi-dev.json under the subagents key; default profiles are reviewer, coder, scout, and minimal. The coder profile requires an implementationPlan with intent, modifications, and additions. Optionally pass a `title` to set the Herdr pane/tab label; otherwise the label is derived from the task, profile, and cwd. The subagent writes its final result to an artifact file and calls subagent_notify when done.",
		parameters: SubagentParams,
		execute: executeSubagent,
	});

	pi.registerTool({
		name: "Agent",
		label: "Agent",
		description:
			"Alias for the subagent tool. Use when a skill or prompt refers to an Agent. Launches a specialized subagent that writes its final result to an artifact file and calls subagent_notify when done. The coder profile requires an implementationPlan. Accepts the same parameters, including an optional `title` for the Herdr pane/tab label.",
		parameters: SubagentParams,
		execute: executeSubagent,
	});

	pi.registerTool({
		name: "subagent_notify",
		label: "Subagent Notify",
		description:
			"Notify the parent session that this subagent has finished. Uses a unix socket if SUBAGENT_NOTIFY_SOCKET is set; otherwise falls back to Herdr pane notification.",
		parameters: SubagentNotifyParams,
		async execute(_id, params) {
			const resultFile = params.result_file ?? process.env.SUBAGENT_RESULT_FILE;
			const summary = params.summary ?? "done";
			const type = params.type === "failed" ? "failed" : "done";

			if (!resultFile) {
				return errorResult(
					"Missing result_file; no SUBAGENT_RESULT_FILE env var found either.",
				);
			}

			try {
				const result = await notifySubagentParent({
					type,
					resultFile,
					launchId: params.launch_id ?? process.env.SUBAGENT_LAUNCH_ID,
					paneId: process.env.HERDR_PANE_ID,
					summary,
					parentPaneId: params.parent_pane_id ?? process.env.SUBAGENT_PARENT_PANE_ID,
					socketPath: process.env.SUBAGENT_NOTIFY_SOCKET,
				});
				subagentCompletionSent = true;
				if (result.transport === "socket") {
					return {
						content: [textContent("Notified parent session via socket.")],
						details: {},
					};
				}
				return {
					content: [textContent(result.socketError
						? `Socket failed (${result.socketError}); notified parent pane via Herdr fallback.`
						: "Notified parent pane via Herdr.")],
					details: result.socketError ? { socketError: result.socketError } : {},
				};
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				return errorResult(message);
			}
		},
	});
}

export {
	assistantMessageText,
	buildPiArgs,
	buildPiLaunchScript,
	buildSubagentLabel,
	buildSubagentPrompt,
	completionSummary,
	ensureResultArtifact,
	expandConfigPath,
	extractJiraIssueKey,
	folderName,
	isDuplicateCompletion,
	latestAssistantText,
	mergeProfiles,
	sanitizeLabel,
	taskHeadline,
};
export type { SubagentProfile };
