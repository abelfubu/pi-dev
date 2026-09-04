import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadConfig } from "../lib/config.js";
import { resolveSubagentExecution } from "../lib/subagent/config.js";
import { buildHeadlessSubagentPrompt } from "../lib/subagent/prompt.js";
import { runHeadlessSubagent, truncateUtf8 } from "../lib/subagent/headless-runner.js";
import type { SubagentInvocation } from "../lib/subagent/types.js";
import { executeHerdrSubagent, loadSubagentProfiles, SubagentParams } from "./herdr-tools.js";

function text(text: string) {
	return { type: "text" as const, text };
}

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: "Run one scoped subagent Slice. Headless execution is the default; use backend=herdr only for interactive inspection. Coder calls require an implementation plan.",
		parameters: SubagentParams,
		async execute(id, params: SubagentInvocation, signal, onUpdate, ctx) {
			const cwd = resolve(params.cwd ?? ctx.cwd ?? process.cwd());
			const profiles = await loadSubagentProfiles(cwd);
			const profile = profiles[params.profile];
			if (!profile) {
				return {
					content: [text(`Unknown profile: ${params.profile}. Available: ${Object.keys(profiles).join(", ")}.`)],
					details: {},
					isError: true,
				};
			}
			if (params.profile === "coder" && !params.implementationPlan) {
				return {
					content: [text("The coder profile requires an implementationPlan with intent, modifications, and additions.")],
					details: {},
					isError: true,
				};
			}

			const execution = resolveSubagentExecution(profile, params);
			if (execution.backend === "herdr") {
				if (process.env.HERDR_ENV !== "1") {
					return { content: [text("The Herdr backend requires a Herdr-managed parent session.")], details: {}, isError: true };
				}
				return executeHerdrSubagent(id, params, signal, onUpdate, ctx);
			}

			const files = (params.files ?? []).map((file) => resolve(cwd, file));
			const missing = files.filter((file) => !existsSync(file));
			if (missing.length) {
				return { content: [text(`Missing files: ${missing.join(", ")}`)], details: { missing }, isError: true };
			}

			const tempDir = await mkdtemp(join(tmpdir(), "pi-subagent-"));
			const promptFile = join(tempDir, "prompt.md");
			await writeFile(promptFile, buildHeadlessSubagentPrompt({
				profile: profile.name,
				task: params.task,
				implementationPlan: params.implementationPlan,
			}), "utf8");

			try {
				const config = await loadConfig(cwd).catch(() => ({ subagentDefaults: undefined }));
				const result = await runHeadlessSubagent({
					cwd,
					profile,
					model: execution.model,
					thinking: execution.thinking,
					files,
					promptFile,
					signal,
					timeoutMs: profile.timeoutMs,
					maxConcurrency: config.subagentDefaults?.maxConcurrency ?? 4,
					onUpdate: (partial) => onUpdate?.({
						content: [text(`Running ${profile.name} · ${partial.model ?? "default model"} · ${partial.usage.turns} turns · ${partial.usage.input} input · ${partial.usage.output} output tokens`) ],
						details: partial,
					}),
				});
				const usageSummary = `${profile.name}: ${result.status} · ${result.model ?? "default model"} · thinking: ${result.thinking ?? "default"} · ${result.usage.turns} turns · ${result.usage.input} input · ${result.usage.output} output · ${result.usage.cacheRead} cache-read tokens${result.usage.cost ? ` · $${result.usage.cost.toFixed(4)}` : ""}`;
				ctx.ui.notify(usageSummary, result.status === "completed" ? "info" : "warning");
				const output = result.output ? truncateUtf8(result.output) : result.error ?? "Subagent failed without output.";
				return {
					content: [text(output)],
					details: { ...result, backend: "headless", profile: profile.name },
					...(result.status === "completed" ? {} : { isError: true as const }),
				};
			} finally {
				await rm(tempDir, { recursive: true, force: true });
			}
		},
	});
}
