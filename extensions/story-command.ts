import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerCommand("story", {
    description: "Run the slice-ship workflow for a Jira user story",
    handler: async (args, ctx) => {
      const key = args.trim();
      if (!key) {
        if (ctx.hasUI) {
          ctx.ui.notify("Usage: /story <JIRA-KEY>", "error");
        }
        return;
      }

      pi.sendMessage({
        customType: "story-command",
        content: `Run the slice-ship workflow for user story **${key}**. Follow the orchestrator in orchestrator-sketch.md:\n\n1. Run chain \`grill-with-docs\` for ${key}\n2. Run chain \`prepare-slices\` for ${key} using the PRD from step 1\n3. For each child slice created, run \`implement-slice\`, then ask me for approval, then run \`ship-slice\`\n4. Transition ${key} to Done when all slices are shipped\n\nPause at every approval gate and wait for my go-ahead before shipping.`,
        display: true,
      });
    },
  });
}
