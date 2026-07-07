import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { runHerdr, runHerdrJson, shellQuote } from "../lib/herdr.js";

export default function (pi: ExtensionAPI) {
  if (process.env.HERDR_ENV !== "1") {
    return;
  }

  pi.registerTool({
    name: "herdr_handoff",
    label: "Herdr Handoff",
    description:
      "Open a new focused Herdr tab in the current workspace, start a fresh interactive pi session, and seed it with a prompt. Use when the user wants to hand off a slice of work to a separate interactive session, especially when they say things like 'hand off', 'new tab', or 'work on this in a fresh pi'.",
    parameters: Type.Object({
      title: Type.String({ description: "Title for the new Herdr tab" }),
      prompt: Type.String({
        description:
          "Markdown prompt to seed as the first input in the new pi session",
      }),
      files: Type.Optional(
        Type.Array(Type.String(), {
          description:
            "Optional files to attach with @file references (resolved relative to cwd)",
        }),
      ),
      cwd: Type.Optional(
        Type.String({
          description:
            "Working directory for the new pi session; defaults to the current cwd",
        }),
      ),
      model: Type.Optional(
        Type.String({
          description: "Optional model/provider to pass to pi with --model",
        }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = resolve(
          params.cwd ??
            (ctx?.cwd as string | undefined) ??
            process.cwd(),
        );

        const files = (params.files ?? []).map((f) => resolve(cwd, f));
        const missing = files.filter((f) => !existsSync(f));
        if (missing.length > 0) {
          return {
            content: [
              {
                type: "text",
                text: `Missing files: ${missing.join(", ")}`,
              },
            ],
            isError: true,
            details: { missing },
          };
        }

        const tabResult = (await runHerdrJson([
          "tab",
          "create",
          "--label",
          params.title,
        ])) as any;

        const tabId = tabResult?.result?.tab?.tab_id as string | undefined;
        const paneId = tabResult?.result?.root_pane?.pane_id as string | undefined;
        if (!tabId || !paneId) {
          throw new Error(
            `herdr tab create did not return tab/pane ids: ${JSON.stringify(tabResult)}`,
          );
        }

        const piArgs: string[] = [];
        if (params.model) {
          piArgs.push("--model", shellQuote(params.model));
        }
        for (const file of files) {
          piArgs.push(shellQuote(`@${file}`));
        }
        piArgs.push(shellQuote(params.prompt));

        const command = `cd ${shellQuote(cwd)} && pi ${piArgs.join(" ")}`;
        await runHerdr(["pane", "run", paneId, command]);

        return {
          content: [
            {
              type: "text",
              text: `Handed off to tab **${tabId}** (${params.title})`,
            },
          ],
          details: {
            tab: tabId,
            pane: paneId,
            title: params.title,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: "text", text: message }],
          isError: true,
          details: {},
        };
      }
    },
  });
}
