import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

/**
 * Activates the built-in `tool_search` tool for every session.
 *
 * Pi-dev registers orchestrator-only tools (jira, gh_pr, github_watch,
 * worktrunk, diffview_review, herdr_*) with `exposure: "deferred"` so they
 * stay out of the system prompt until needed. `tool_search` is how the model
 * finds and activates them at runtime, but pi ships it inactive by default
 * (`defaultActive: false`). Activating it here keeps clients zero-config —
 * no `defaultTools` settings change required.
 *
 * Unknown names are ignored by setActiveTools, so on older pi versions
 * without tool_search this is a no-op.
 */
export default function (pi: ExtensionAPI) {
	pi.on("session_start", () => {
		// ACP owns delegate tool selection; don't expand it by automatically
		// activating discovery. This is a loadout choice, not a permission gate.
		if (process.env.PI_ACP_DELEGATE_DEPTH) return;
		const active = pi.getActiveTools();
		if (!active.includes("tool_search")) {
			pi.setActiveTools([...active, "tool_search"]);
		}
	});
}
