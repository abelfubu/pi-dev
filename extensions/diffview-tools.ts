import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { createHerdrPane, runInPane, shellQuote, zoomHerdrPane } from "../lib/herdr.js";
import { resolveReviewTarget } from "../lib/tuicr.js";

interface DiffviewToolDetails {
	paneId: string;
	repoDir: string;
	baseSha: string;
	headSha: string;
	mergeBaseSha: string;
}

function requireString(value: unknown, name: string): string {
	if (typeof value !== "string" || !value.trim()) {
		throw new Error(`${name} is required.`);
	}
	return value.trim();
}

export default function registerDiffviewTools(pi: ExtensionAPI) {
	const parameters = Type.Object({
		repoDir: Type.String({ description: "Absolute repository directory" }),
		baseRef: Type.String({ description: "Fixed Git base ref" }),
	});

	pi.registerTool<typeof parameters, DiffviewToolDetails>({
		name: "diffview_review",
		label: "Diffview Review",
		description: "Open an exact local diff in Neovim Diffview in a focused Herdr pane.",
		promptSnippet: "Open a deterministic local diff in Neovim Diffview",
		promptGuidelines: ["Use diffview_review when the user wants to review in Neovim"],
		executionMode: "sequential",
		parameters,
		async execute(_id, params) {
			const repoDir = requireString(params.repoDir, "repoDir");
			const baseRef = requireString(params.baseRef, "baseRef");
			const target = await resolveReviewTarget(repoDir, baseRef);
			const pane = await createHerdrPane(
				"pane",
				"diffview review",
				target.repoDir,
				undefined,
				true,
			);

			if (!pane.paneId) throw new Error("Herdr did not return a pane ID.");

			await zoomHerdrPane(pane.paneId, true);
			const command = ["exec nvim", `-c ${shellQuote(`DiffviewOpen ${target.revisions}`)}`].join(
				" ",
			);
			await runInPane(pane.paneId, command);

			return {
				content: [
					{
						type: "text" as const,
						text: [
							`Opened Neovim Diffview in pane ${pane.paneId}.`,
							`Pinned diff: ${target.mergeBaseSha}..${target.headSha}.`,
							"The pane closes when Neovim exits; closing the pane terminates Neovim too.",
						].join("\n"),
					},
				],
				details: {
					paneId: pane.paneId,
					repoDir: target.repoDir,
					baseSha: target.baseSha,
					headSha: target.headSha,
					mergeBaseSha: target.mergeBaseSha,
				},
			};
		},
	});
}
