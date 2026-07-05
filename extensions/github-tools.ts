import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import registerPrTools from "../lib/github/pr-tools.js";
import registerIssueTools from "../lib/github/issue-tools.js";
import registerRunTools from "../lib/github/run-tools.js";
import registerWorkflowTools from "../lib/github/workflow-tools.js";
import registerReleaseTools from "../lib/github/release-tools.js";

export default function (pi: ExtensionAPI) {
  registerPrTools(pi);
  registerIssueTools(pi);
  registerRunTools(pi);
  registerWorkflowTools(pi);
  registerReleaseTools(pi);
}
