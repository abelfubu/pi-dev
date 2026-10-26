import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { shellQuote } from "../lib/herdr.js";
import { describeTerminalWindow, openReviewWindow } from "../lib/terminal.js";
import { resolveReviewTarget } from "../lib/tuicr.js";

interface DiffviewToolDetails {
  platform: "rex" | "herdr";
  windowId?: string;
  blockId?: string;
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
    label: Type.Optional(Type.String({ description: "Review window/tab label; use the task name" })),
    focus: Type.Optional(Type.Boolean({ description: "Focus the review window/tab; defaults to false" })),
  });

  pi.registerTool<typeof parameters, DiffviewToolDetails>({
    name: "diffview_review",
    label: "Diffview Review",
    exposure: "deferred",
    description: "Open an exact local diff in Neovim Diffview in a new Rex window or the orchestrator's reusable Herdr review tab without stealing focus.",
    promptSnippet: "Open a deterministic local diff in Neovim Diffview",
    promptGuidelines: [
      "Use diffview_review when the user wants to review in Neovim. Automatically detects Rex or Herdr; the window/tab stays available when Neovim exits.",
    ],
    executionMode: "sequential",
    parameters,
    async execute(_id, params) {
      const repoDir = requireString(params.repoDir, "repoDir");
      const baseRef = requireString(params.baseRef, "baseRef");
      const target = await resolveReviewTarget(repoDir, baseRef);
      const command = `nvim -c ${shellQuote(`DiffviewOpen ${target.revisions}`)}`;

      const pane = await openReviewWindow(command, target.repoDir, params.label ?? "Diffview", params.focus ?? false);

      return {
        content: [
          {
            type: "text" as const,
            text: [
              `Opened Neovim Diffview in ${describeTerminalWindow(pane)}.`,
              `Pinned diff: ${target.mergeBaseSha}..${target.headSha}.`,
              "The window/tab remains available when Neovim exits.",
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
