import * as net from "node:net";
import { Type } from "typebox";
import { notifyPane } from "../herdr.js";

/**
 * Shared subagent-completion notification plumbing.
 *
 * Lives in lib (not in an extension) so both the parent-side herdr-tools
 * extension and the child-side subagent-notify-tools extension can use it.
 * Herdr subagents launch with `--no-extensions` and only load
 * subagent-notify-tools.ts explicitly, so anything the child needs must not
 * depend on the rest of herdr-tools.ts.
 */

export const SubagentNotifyParams = Type.Object({
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

let completionSent = false;

export function isSubagentCompletionSent(): boolean {
	return completionSent;
}

export function markSubagentCompletionSent(): void {
	completionSent = true;
}

export function resetSubagentCompletionSent(): void {
	completionSent = false;
}

export function sendNotifyMessage(socketPath: string, message: string): Promise<void> {
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

export async function notifySubagentParent(params: {
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
