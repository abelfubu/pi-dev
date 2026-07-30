import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerPrTools from "../lib/github/pr-tools.js";
import registerIssueTools from "../lib/github/issue-tools.js";
import registerRunTools from "../lib/github/run-tools.js";
import registerWorkflowTools from "../lib/github/workflow-tools.js";
import registerReleaseTools from "../lib/github/release-tools.js";

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", (event) => {
    if (event.toolName !== "bash") return undefined;

    const command = String(event.input.command ?? "");
    if (/\bgh\b[^\n;&|]*\bpr\s+create\b/i.test(command)) {
      return {
        block: true,
        reason:
          "Direct `gh pr create` is blocked. Use the gh_pr tool so the one-open-PR-per-user policy is enforced.",
      };
    }

    if (process.env.SUBAGENT_RESULT_FILE && /\bgit\s+push\b/i.test(command)) {
      return {
        block: true,
        reason: "Subagents cannot push branches. The parent orchestrator owns shipping.",
      };
    }

    return undefined;
  });

  registerPrTools(pi);
  registerIssueTools(pi);
  registerRunTools(pi);
  registerWorkflowTools(pi);
  registerReleaseTools(pi);
}
