import type { SubagentInvocation, SubagentProfile } from "./types.js";

export function resolveSubagentExecution(
	profile: SubagentProfile,
	invocation: Pick<SubagentInvocation, "backend" | "model" | "thinking">,
) {
	return {
		backend: invocation.backend ?? profile.backend ?? "headless",
		model: invocation.model?.trim() || profile.model?.trim() || undefined,
		thinking: invocation.thinking ?? profile.thinking,
	};
}
