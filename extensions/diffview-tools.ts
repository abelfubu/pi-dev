import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { openHerdrPopup, shellQuote } from "../lib/herdr.js";
import { resolveReviewTarget } from "../lib/tuicr.js";

interface DiffviewToolDetails {
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
			const command = ["nvim", `-c ${shellQuote(`DiffviewOpen ${target.revisions}`)}`].join(
				" ",
			);

			await openHerdrPopup(command, target.repoDir, {
				width: "90%",
				height: "90%",
				focus: true,
			});

			return {
				content: [
					{
						type: "text" as const,
						text: [
							"Opened Neovim Diffview in a Herdr popup.",
							`Pinned diff: ${target.mergeBaseSha}..${target.headSha}.`,
							"The popup closes when Neovim exits.",
						].join("\n"),
					},
				],
				details: {
					repoDir: target.repoDir,
					baseSha: target.baseSha,
					headSha: target.headSha,
					mergeBaseSha: target.mergeBaseSha,
				},
			};
		},
	});
}
