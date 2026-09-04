export type SubagentBackend = "headless" | "herdr";
export type SubagentThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

export interface SubagentProfile {
	name: string;
	backend?: SubagentBackend;
	layout?: "tab" | "pane";
	model?: string;
	thinking?: SubagentThinkingLevel;
	timeoutMs?: number;
	tools?: string[];
	excludeTools?: string[];
	extensions?: string[];
	skills?: string[];
	promptTemplates?: string[];
}

export interface ImplementationPlan {
	intent: string;
	modifications: string[];
	additions: string[];
}

export interface SubagentInvocation {
	profile: string;
	task: string;
	implementationPlan?: ImplementationPlan;
	title?: string;
	files?: string[];
	cwd?: string;
	model?: string;
	backend?: SubagentBackend;
	thinking?: SubagentThinkingLevel;
}
