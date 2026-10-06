import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { closeHerdrPane, closeHerdrTab } from "../lib/herdr.js";

function textContent(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

function errorResult(message: string) {
  return { content: [textContent(message)], isError: true, details: {} };
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "herdr_close",
    label: "Herdr Close",
    exposure: "deferred",
    description: "Close a Herdr pane or tab when it is no longer needed. Provide either pane or tab, not both.",
    parameters: Type.Object({
      pane: Type.Optional(Type.String({ description: "Herdr pane ID to close" })),
      tab: Type.Optional(Type.String({ description: "Herdr tab ID to close" })),
    }),
    async execute(_id, params) {
      try {
        if (params.pane && params.tab) return errorResult("Provide either pane or tab, not both.");
        if (params.pane) {
          await closeHerdrPane(params.pane);
          return { content: [textContent(`Closed pane **${params.pane}**.`)], details: {} };
        }
        if (params.tab) {
          await closeHerdrTab(params.tab);
          return { content: [textContent(`Closed tab **${params.tab}**.`)], details: {} };
        }
        return errorResult("Provide either pane or tab.");
      } catch (error) {
        return errorResult(error instanceof Error ? error.message : String(error));
      }
    },
  });
}
