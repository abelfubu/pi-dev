import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { openHerdrPopup, shellQuote } from "../lib/herdr.js";
import { resolveReviewTarget } from "../lib/tuicr.js";

interface DiffviewToolDetails {
  popup: true;
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
    description: "Open an exact local diff in Neovim Diffview in a focused full-screen Herdr popup.",
    promptSnippet: "Open a deterministic local diff in Neovim Diffview",
    promptGuidelines: [
      "Use diffview_review when the user wants to review in Neovim. The popup closes when Neovim exits.",
    ],
    executionMode: "sequential",
    parameters,
    async execute(_id, params) {
      const repoDir = requireString(params.repoDir, "repoDir");
      const baseRef = requireString(params.baseRef, "baseRef");
      const target = await resolveReviewTarget(repoDir, baseRef);
      const command = `exec nvim -c ${shellQuote(`DiffviewOpen ${target.revisions}`)}`;

      await openHerdrPopup(command, target.repoDir, { focus: true });

      return {
        content: [
          {
            type: "text" as const,
            text: [
              "Opened Neovim Diffview in a full-screen Herdr popup.",
              `Pinned diff: ${target.mergeBaseSha}..${target.headSha}.`,
              "The popup closes when Neovim exits.",
            ].join("\n"),
          },
        ],
        details: {
          popup: true,
          repoDir: target.repoDir,
          baseSha: target.baseSha,
          headSha: target.headSha,
          mergeBaseSha: target.mergeBaseSha,
        },
      };
    },
  });
}
