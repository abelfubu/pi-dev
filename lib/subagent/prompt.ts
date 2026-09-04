import type { ImplementationPlan } from "./types.js";

export function buildHeadlessSubagentPrompt(params: {
	profile: string;
	task: string;
	implementationPlan?: ImplementationPlan;
}): string {
	const plan = params.implementationPlan;
	return [
		...(plan ? [
			"## Implementation plan",
			"",
			"### Intent",
			plan.intent,
			"",
			"### Modifications",
			...(plan.modifications.length ? plan.modifications.map((item) => `- ${item}`) : ["- None"]),
			"",
			"### Additions",
			...(plan.additions.length ? plan.additions.map((item) => `- ${item}`) : ["- None"]),
			"",
		] : []),
		"## Task",
		params.task,
		"",
		`Profile: ${params.profile}`,
		"Return the complete result in your final response. Do not call a completion or notification tool.",
	].join("\n");
}
