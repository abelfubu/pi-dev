import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { resolve } from "node:path";
import { Type } from "typebox";
import { describeTerminalWindow, openTerminalWindow } from "../lib/terminal.js";

export default function registerTerminalStartTools(pi: ExtensionAPI) {
  const parameters = Type.Object({
    command: Type.String({ description: "Shell command to run in a fresh Rex window or Herdr tab" }),
    cwd: Type.Optional(Type.String({ description: "Working directory; defaults to caller's cwd" })),
    label: Type.Optional(Type.String({ description: "Window/tab label" })),
    focus: Type.Optional(Type.Boolean({ description: "Focus the viewer; defaults to false" })),
  });
  pi.registerTool({
    name: "terminal_start",
    label: "Terminal Start",
    exposure: "deferred",
    description: "Run a command in a fresh window/tab in the caller's Rex session or Herdr workspace. Automatically detects the host. Use for Neovim + Markview plan reviews.",
    executionMode: "sequential",
    parameters,
    async execute(_id, params, _signal, _onUpdate, ctx) {
      if (!params.command.trim()) throw new Error("command is required.");
      const cwd = resolve(params.cwd ?? ctx.cwd ?? process.cwd());
      const window = await openTerminalWindow(params.command, cwd, params.label?.trim() || "Plan", params.focus ?? false);
      return {
        content: [{ type: "text" as const, text: `Started command in ${describeTerminalWindow(window)}.` }],
        details: { ...window, command: params.command, cwd },
      };
    },
  });
}
