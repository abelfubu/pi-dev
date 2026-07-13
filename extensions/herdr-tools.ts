import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { existsSync, rmSync } from "node:fs";
import { mkdtemp } from "node:fs/promises";
import * as net from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";
import {
	closeHerdrPane,
	closeHerdrTab,
	createHerdrPane,
	notifyPane,
	runInPane,
	shellQuote,
} from "../lib/herdr.js";

const EXTENSION_PATH = fileURLToPath(import.meta.url);

function textContent(text: string): { type: "text"; text: string } {
	return { type: "text", text };
}

interface SubagentDetails {
	missing?: string[];
	profile?: string;
	pane?: string;
	tab?: string;
	resultFile?: string;
	socketError?: string;
}

interface SubagentProfile {
	name: string;
	tools: string[];
	skills?: string[];
	model?: string;
	layout: "tab" | "pane";
}

const SUBAGENT_PROFILES: Record<string, SubagentProfile> = {
	reviewer: {
		name: "reviewer",
		tools: ["read", "ffgrep", "fffind", "ast_grep_search", "jira"],
		layout: "tab",
	},
	coder: {
		name: "coder",
		tools: ["read", "edit", "write", "bash", "fffind", "ffgrep", "ast_grep_search", "ast_grep_replace", "code_check_discover", "code_check", "code_check_parallel"],
		skills: ["tdd", "check"],
		layout: "tab",
	},
	scout: {
		name: "scout",
		tools: ["read", "edit", "write", "bash", "fffind", "ffgrep", "ast_grep_search"],
		layout: "pane",
	},
	minimal: {
		name: "minimal",
		tools: ["read", "write"],
		layout: "pane",
	},
};

function errorResult(message: string, details: SubagentDetails = {}) {
	return {
		content: [textContent(message)],
		isError: true as const,
		details,
	};
}

function resolveSkillPath(skillName: string): string {
	return join(getAgentDir(), "skills", skillName);
}

let notifySocketPromise: Promise<string | null> | null = null;
let notifySocketServer: net.Server | null = null;
let notifySocketDir: string | null = null;
let notifySocketPath: string | null = null;

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

function handleNotifyMessage(conn: net.Socket, raw: string, pi?: ExtensionAPI) {
	try {
		const msg = JSON.parse(raw);
		if (msg.type === "done" && pi) {
			const resultFile = msg.resultFile ?? "unknown";
			const summary = msg.summary ?? "done";
			pi.sendUserMessage(
				`Subagent done: ${resultFile} (${summary})`,
				{ deliverAs: "followUp" },
			);
			respond(conn, { ok: true });
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

function buildSubagentPrompt(params: {
	task: string;
	profile: string;
	parentPaneId: string;
	resultFile: string;
}): string {
	return [
		`## Task`,
		params.task,
		``,
		`## Subagent context`,
		`- Profile: ${params.profile}`,
		`- Parent pane: ${params.parentPaneId}`,
		`- Result file: ${params.resultFile}`,
		`- Environment variables: SUBAGENT_PARENT_PANE_ID, SUBAGENT_RESULT_FILE, SUBAGENT_NOTIFY_SOCKET`,
		``,
		`When you finish, write your final result to the result file, then call the subagent_notify tool with:`,
		`- type: done`,
		`- result_file: ${params.resultFile}`,
		`- summary: a one-line summary of what you found or did`,
	].join("\n");
}

const SubagentParams = Type.Object({
	profile: Type.String({
		description: "Subagent profile name: reviewer, coder, scout, or minimal",
	}),
	task: Type.String({
		description: "Markdown task for the subagent",
	}),
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
	summary: Type.Optional(
		Type.String({
			description: "One-line summary of the result",
		}),
	),
});

async function executeSubagent(
	_id: string,
	params: {
		profile: string;
		task: string;
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
		const profile = SUBAGENT_PROFILES[params.profile];
		if (!profile) {
			return errorResult(
				`Unknown profile: ${params.profile}. Available: ${Object.keys(SUBAGENT_PROFILES).join(", ")}.`,
			);
		}

		const files = (params.files ?? []).map((f) => resolve(cwd, f));
		const missing = files.filter((f) => !existsSync(f));
		if (missing.length > 0) {
			return errorResult(`Missing files: ${missing.join(", ")}`, { missing });
		}

		const skillPaths: string[] = [];
		if (profile.skills) {
			for (const skillName of profile.skills) {
				const skillPath = resolveSkillPath(skillName);
				if (!existsSync(join(skillPath, "SKILL.md"))) {
					return errorResult(`Skill not found: ${skillName}`, {
						profile: profile.name,
					});
				}
				skillPaths.push(skillPath);
			}
		}

		const resultDir = await mkdtemp(join(tmpdir(), "pi-subagent-"));
		const resultFile = resolve(
			resultDir,
			`${profile.name}-result.md`,
		);

		const parentPaneId = process.env.HERDR_PANE_ID;
		if (!parentPaneId) {
			return errorResult("Not running inside a Herdr-managed pane.");
		}

		const socketPath = await ensureNotifySocket();

		const container = await createHerdrPane(profile.layout, profile.name, cwd);
		if (!container.paneId) {
			throw new Error("herdr did not return a pane id");
		}

		const piArgs: string[] = ["-ne", "-e", EXTENSION_PATH, "-e", "npm:pi-glance"];
		for (const skillPath of skillPaths) {
			piArgs.push("--skill", skillPath);
		}
		piArgs.push("--tools", [...profile.tools, "subagent_notify", "todo"].join(","));
		const model = params.model ?? profile.model;
		if (model) piArgs.push("--model", model);
		for (const file of files) {
			piArgs.push(`@${file}`);
		}
		piArgs.push(
			buildSubagentPrompt({
				task: params.task,
				profile: profile.name,
				parentPaneId,
				resultFile,
			}),
		);

		const envVars = [
			`SUBAGENT_PARENT_PANE_ID=${shellQuote(parentPaneId)}`,
			`SUBAGENT_RESULT_FILE=${shellQuote(resultFile)}`,
			...(socketPath ? [`SUBAGENT_NOTIFY_SOCKET=${shellQuote(socketPath)}`] : []),
		].join(" ");
		const command = `cd ${shellQuote(cwd)} && ${envVars} pi ${piArgs.map(shellQuote).join(" ")}`;
		await runInPane(container.paneId, command);

		return {
			content: [
				textContent(container.tabId
					? `Subagent **${profile.name}** launched in tab **${container.tabId}**. Result will be written to ${resultFile}; it will call \`subagent_notify\` when done.`
					: `Subagent **${profile.name}** launched in pane **${container.paneId}**. Result will be written to ${resultFile}; it will call \`subagent_notify\` when done.`),
			],
			details: { profile: profile.name, pane: container.paneId, tab: container.tabId, resultFile, socketPath },
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

	if (process.env.HERDR_ENV !== "1") {
		return;
	}

	// Start the notify socket server if we are the parent (not a subagent).
	if (!process.env.SUBAGENT_NOTIFY_SOCKET) {
		ensureNotifySocket(pi);
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

				const container = await createHerdrPane("tab", params.title, cwd);
				if (!container.paneId || !container.tabId) {
					throw new Error(
						`herdr tab create did not return tab/pane ids: ${JSON.stringify(container)}`,
					);
				}

				const piArgs: string[] = [];
				if (params.model) {
					piArgs.push("--model", shellQuote(params.model));
				}
				for (const file of files) {
					piArgs.push(shellQuote(`@${file}`));
				}
				piArgs.push(shellQuote(params.prompt));

				const command = `cd ${shellQuote(cwd)} && pi ${piArgs.join(" ")}`;
				await runInPane(container.paneId, command);

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
			"Launch a specialized subagent in a new Herdr tab or pane. Profiles: reviewer, coder, scout, minimal. The subagent is restricted to a small tool/skill set, writes its final result to an artifact file, and calls `subagent_notify` when done to signal completion to the parent session.",
		parameters: SubagentParams,
		execute: executeSubagent,
	});

	pi.registerTool({
		name: "Agent",
		label: "Agent",
		description:
			"Alias for the subagent tool. Use when a skill or prompt refers to an Agent. Launches a specialized subagent that writes its final result to an artifact file and calls `subagent_notify` when done.",
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
			const socketPath = process.env.SUBAGENT_NOTIFY_SOCKET;
			const resultFile = params.result_file ?? process.env.SUBAGENT_RESULT_FILE;
			const summary = params.summary ?? "done";

			if (!resultFile) {
				return errorResult(
					"Missing result_file; no SUBAGENT_RESULT_FILE env var found either.",
				);
			}

			const message = JSON.stringify({
				type: params.type ?? "done",
				resultFile,
				summary,
			});

			if (socketPath) {
				try {
					await sendNotifyMessage(socketPath, message);
					return {
						content: [textContent("Notified parent session via socket.")],
						details: {},
					};
				} catch (err) {
					const fallbackError = err instanceof Error ? err.message : String(err);
					// Fall back to Herdr
					const parentPaneId = params.parent_pane_id ?? process.env.SUBAGENT_PARENT_PANE_ID;
					if (!parentPaneId) {
						return errorResult(
							`Socket notify failed and no Herdr parent pane id: ${fallbackError}`,
						);
					}
					await notifyPane(
						parentPaneId,
						`subagent done: ${resultFile} (${summary})`,
					);
					return {
						content: [textContent(`Socket failed (${fallbackError}); notified parent pane ${parentPaneId} via Herdr fallback.`)],
						details: { socketError: fallbackError },
					};
				}
			}

			// No socket: Herdr fallback
			const parentPaneId = params.parent_pane_id ?? process.env.SUBAGENT_PARENT_PANE_ID;
			if (!parentPaneId) {
				return errorResult(
					"Missing parent_pane_id; no SUBAGENT_PARENT_PANE_ID or SUBAGENT_NOTIFY_SOCKET env vars found.",
				);
			}
			await notifyPane(
				parentPaneId,
				`subagent done: ${resultFile} (${summary})`,
			);
			return {
				content: [textContent(`Notified parent pane ${parentPaneId} via Herdr.`)],
				details: {},
			};
		},
	});
}
