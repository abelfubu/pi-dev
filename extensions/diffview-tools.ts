import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { openHerdrReviewTab, shellQuote } from "../lib/herdr.js";
import { resolveReviewTarget } from "../lib/tuicr.js";

interface DiffviewToolDetails {
  paneId?: string;
  tabId?: string;
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
    label: Type.Optional(Type.String({ description: "Review tab label; use the task name" })),
    focus: Type.Optional(Type.Boolean({ description: "Focus the review tab; defaults to false" })),
  });

  pi.registerTool<typeof parameters, DiffviewToolDetails>({
    name: "diffview_review",
    label: "Diffview Review",
    exposure: "deferred",
    description: "Open an exact local diff in Neovim Diffview in the orchestrator's reusable Herdr review tab without stealing focus.",
    promptSnippet: "Open a deterministic local diff in Neovim Diffview",
    promptGuidelines: [
      "Use diffview_review when the user wants to review in Neovim. Reuses the caller's review tab in its workspace; the tab stays available when Neovim exits.",
    ],
    executionMode: "sequential",
    parameters,
    async execute(_id, params) {
      const repoDir = requireString(params.repoDir, "repoDir");
      const baseRef = requireString(params.baseRef, "baseRef");
      const target = await resolveReviewTarget(repoDir, baseRef);
      const command = `nvim -c ${shellQuote(`DiffviewOpen ${target.revisions}`)}`;

      const pane = await openHerdrReviewTab(command, target.repoDir, params.label ?? "Diffview", params.focus ?? false);

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Opened Neovim Diffview in Herdr review tab ${pane.tabId}.`,
              `Pinned diff: ${target.mergeBaseSha}..${target.headSha}.`,
              "The tab remains available when Neovim exits.",
            ].join("\n"),
          },
        ],
        details: {
          ...pane,
          repoDir: target.repoDir,
          baseSha: target.baseSha,
          headSha: target.headSha,
          mergeBaseSha: target.mergeBaseSha,
        },
      };
    },
  });
}
