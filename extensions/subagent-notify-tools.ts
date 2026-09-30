import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	markSubagentCompletionSent,
	notifySubagentParent,
	SubagentNotifyParams,
} from "../lib/subagent/notify.js";

function textContent(text: string): { type: "text"; text: string } {
	return { type: "text", text };
}

function errorResult(message: string) {
	return {
		content: [textContent(message)],
		isError: true as const,
		details: {},
	};
}

/**
 * Child-side completion notification tool.
 *
 * Herdr subagents launch with `--no-extensions` so orchestrator-only tools
 * (jira, gh_pr, github_watch, worktrunk, ...) never exist in their process.
 * This extension is the single explicit exception: the subagent launcher
 * passes it via `--extension` so the child can report completion to the
 * parent. Keep it minimal — everything registered here is reachable by
 * every subagent.
 */
export default function (pi: ExtensionAPI) {
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
				markSubagentCompletionSent();
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
