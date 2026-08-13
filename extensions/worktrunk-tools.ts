import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { createWorktree, listWorktrees, removeWorktree } from "../lib/worktrunk.js";

interface WorktrunkToolDetails {
	action: "create" | "list" | "remove";
	branch?: string;
	path?: string;
	worktrees?: unknown[];
	result?: unknown;
}

function requireString(value: unknown, name: string): string {
	if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required.`);
	return value.trim();
}

export default function registerWorktrunkTools(pi: ExtensionAPI) {
	const parameters = Type.Object({
		action: Type.Union([
			Type.Literal("create"),
			Type.Literal("list"),
			Type.Literal("remove"),
		]),
		repoDir: Type.String({ description: "Absolute path inside the repository" }),
		branch: Type.Optional(
			Type.String({ description: "Branch name; required for create and remove" }),
		),
		baseRef: Type.Optional(
			Type.String({ description: "Base branch or ref; required for create" }),
		),
	});

	pi.registerTool<typeof parameters, WorktrunkToolDetails>({
		name: "worktrunk",
		label: "Worktrunk",
		description:
			"Create, list, or safely remove Git worktrees through Worktrunk. Creation runs approved lifecycle hooks before returning.",
		promptSnippet: "Manage deterministic agent worktrees through Worktrunk",
		promptGuidelines: [
			"Use worktrunk instead of raw git worktree commands. Never force-remove worktrees or unmerged branches.",
		],
		executionMode: "sequential",
		parameters,
		async execute(_id, params) {
			const action = params.action as "create" | "list" | "remove";
			const repoDir = requireString(params.repoDir, "repoDir");

			if (action === "create") {
				const branch = requireString(params.branch, "branch");
				const baseRef = requireString(params.baseRef, "baseRef");
				const worktree = await createWorktree(repoDir, branch, baseRef);
				return {
					content: [{
						type: "text" as const,
						text: `Created Worktrunk worktree for ${worktree.branch} at ${worktree.path}. Lifecycle hooks completed.`,
					}],
					details: { action, ...worktree },
				};
			}

			if (action === "list") {
				const worktrees = await listWorktrees(repoDir);
				return {
					content: [{ type: "text" as const, text: JSON.stringify(worktrees, null, 2) }],
					details: { action, worktrees },
				};
			}

			if (action === "remove") {
				const branch = requireString(params.branch, "branch");
				const result = await removeWorktree(repoDir, branch);
				return {
					content: [{ type: "text" as const, text: `Removed merged Worktrunk worktree ${branch}.` }],
					details: { action, branch, result },
				};
			}

			throw new Error(`Unknown action: ${String(action)}`);
		},
	});
}
