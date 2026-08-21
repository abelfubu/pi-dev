import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { resolve } from "node:path";
import { Type } from "typebox";
import {
  createHerdrPane,
  openHerdrPopup,
  runInPane,
  zoomHerdrPane,
} from "../lib/herdr.js";

interface HerdrStartDetails {
  paneId?: string;
  command: string;
  cwd: string;
  zoomed: boolean;
  popup?: boolean;
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
    popup: Type.Optional(
      Type.Boolean({
        description:
          "Open the command in a Herdr popup via the herdr-popup plugin at 90%; overrides zoomed",
      }),
    ),
  });

  pi.registerTool<typeof parameters, HerdrStartDetails>({
    name: "herdr_start",
    label: "Herdr Start",
    description:
      "Create a Herdr pane or popup and run an arbitrary shell command in it, with optional focus, zoom, or popup.",
    promptSnippet: "Start a command in a new Herdr pane or popup with optional focus, zoom, or popup",
    executionMode: "sequential",
    parameters,
    async execute(_id, params, _signal, _onUpdate, ctx) {
      const command = requireString(params.command, "command");
      const cwd = resolve(params.cwd ?? ctx?.cwd ?? process.cwd());
      const focus = params.focus ?? true;
      const zoomed = params.zoomed ?? false;
      const popup = params.popup ?? false;

      if (popup) {
        await openHerdrPopup(command, cwd, {
          width: "90%",
          height: "90%",
          focus,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: "Started command in a Herdr popup (90%). The popup closes when the command exits.",
            },
          ],
          details: { command, cwd, zoomed, popup: true },
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
