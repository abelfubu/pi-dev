import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { resolve } from "node:path";
import { Type } from "typebox";
import {
  createHerdrPane,
  openHerdrPopup,
  openHerdrReviewTab,
  runInPane,
  zoomHerdrPane,
} from "../lib/herdr.js";

interface HerdrStartDetails {
  paneId?: string;
  tabId?: string;
  command: string;
  cwd: string;
  zoomed: boolean;
  popup: boolean;
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${name} is required.`);
  }
  return value.trim();
}

export default function registerHerdrStartTools(pi: ExtensionAPI) {
  const parameters = Type.Object({
    command: Type.String({ description: "Shell command to run in the new pane" }),
    cwd: Type.Optional(
      Type.String({ description: "Working directory; defaults to the caller's cwd" }),
    ),
    label: Type.Optional(
      Type.String({ description: "Pane label; defaults to Command" }),
    ),
    focus: Type.Optional(
      Type.Boolean({ description: "Focus the new pane; defaults to true" }),
    ),
    zoomed: Type.Optional(
      Type.Boolean({ description: "Zoom the new pane; defaults to false" }),
    ),
    reviewTab: Type.Optional(
      Type.Boolean({ description: "Reuse the orchestrator's review tab in its workspace; defaults to no focus and overrides popup and zoomed. Use for Glow plan reviews." }),
    ),
    popup: Type.Optional(
      Type.Boolean({
        description:
          "Open the command in a full-screen Herdr popup via the herdr-popup plugin; overrides zoomed",
      }),
    ),
  });

  pi.registerTool<typeof parameters, HerdrStartDetails>({
    name: "herdr_start",
    label: "Herdr Start",
    exposure: "deferred",
    description:
      "Run a shell command in a Herdr pane, popup, or reusable orchestrator review tab.",
    promptSnippet: "Start a command in a Herdr pane, popup, or reusable review tab",
    executionMode: "sequential",
    parameters,
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const command = requireString(params.command, "command");
      const cwd = resolve(params.cwd ?? ctx?.cwd ?? process.cwd());
      const focus = params.focus ?? !params.reviewTab;
      const zoomed = params.zoomed ?? false;
      const popup = params.popup ?? false;

      if (params.reviewTab) {
        const pane = await openHerdrReviewTab(command, cwd, params.label?.trim() || "Plan", focus);
        return {
          content: [{ type: "text" as const, text: `Started command in Herdr review tab ${pane.tabId}. Return to this tab for subsequent reviews.` }],
          details: { ...pane, command, cwd, zoomed: false, popup: false },
        };
      }

      if (popup) {
        await openHerdrPopup(command, cwd, { focus });

        return {
          content: [
            {
              type: "text" as const,
              text: "Started command in a full-screen Herdr popup. The popup closes when the command exits.",
            },
          ],
          details: { command, cwd, zoomed: false, popup: true },
        };
      }

      const label = params.label?.trim() || "Command";
      const pane = await createHerdrPane("pane", label, cwd, undefined, focus);
      if (!pane.paneId) throw new Error("Herdr did not return a pane ID.");

      if (zoomed) await zoomHerdrPane(pane.paneId, true);
      await runInPane(pane.paneId, command);

      return {
        content: [
          {
            type: "text" as const,
            text: `Started command in Herdr pane ${pane.paneId}${zoomed ? " (zoomed)" : ""}.`,
          },
        ],
        details: { paneId: pane.paneId, command, cwd, zoomed, popup: false },
      };
    },
  });
}
