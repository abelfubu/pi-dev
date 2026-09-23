import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { loadConfig } from "../lib/config.js";
import { resolveSubagentExecution } from "../lib/subagent/config.js";
import { buildHeadlessSubagentPrompt } from "../lib/subagent/prompt.js";
import { runHeadlessSubagent, truncateUtf8, type HeadlessSubagentProgress } from "../lib/subagent/headless-runner.js";
import type { SubagentInvocation } from "../lib/subagent/types.js";
import { executeHerdrSubagent, loadSubagentProfiles, SubagentParams } from "./herdr-tools.js";

function text(text: string) {
	return { type: "text" as const, text };
}

export default function (pi: ExtensionAPI) {
	const backgroundRuns = new Map<string, AbortController>();
	const jobProgress = new Map<string, { profile: string; model?: string; thinking?: string; progress?: HeadlessSubagentProgress; ui: { setWidget: (key: string, lines: string[] | undefined) => void } }>();
	let sessionActive = true;

	const renderJobs = () => {
		const ui = jobProgress.values().next().value?.ui;
		if (!ui) return;
		const lines = [...jobProgress.entries()].map(([id, job]) => {
			const progress = job.progress;
			const usage = progress?.usage;
			return `Subagent ${id.slice(0, 8)} · ${job.profile} · ${progress?.model ?? job.model ?? "default model"} · thinking: ${progress?.thinking ?? job.thinking ?? "default"} · ${usage?.turns ?? 0} turns · ${usage?.input ?? 0} input · ${usage?.output ?? 0} output · ${usage?.cacheRead ?? 0} cache-read${usage?.cost ? ` · $${usage.cost.toFixed(4)}` : ""}`;
		});
		ui.setWidget("subagent-jobs", lines.length > 4 ? [...lines.slice(0, 4), `+${lines.length - 4} more subagent jobs`] : lines);
	};

	pi.on("session_shutdown", () => {
		sessionActive = false;
		for (const controller of backgroundRuns.values()) controller.abort();
		backgroundRuns.clear();
		const ui = jobProgress.values().next().value?.ui;
		jobProgress.clear();
		ui?.setWidget("subagent-jobs", undefined);
	});

	pi.registerTool({
		name: "subagent",
		label: "Subagent",
		description: "Start one scoped subagent Slice. Headless background execution is the default: it returns a job ID immediately and displays completion when ready unless an editor draft must be preserved. Use backend=herdr only for interactive inspection. Coder calls require an implementation plan.",
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

			const config = await loadConfig(cwd).catch(() => ({ subagentDefaults: undefined }));
			if (!sessionActive || signal?.aborted) {
				await rm(tempDir, { recursive: true, force: true });
				throw new Error("Subagent launch aborted before the background job started.");
			}

			const jobId = randomUUID();
			const controller = new AbortController();
			backgroundRuns.set(jobId, controller);
			if (ctx.mode === "tui" && typeof ctx.ui.setWidget === "function") {
				jobProgress.set(jobId, { profile: profile.name, model: execution.model, thinking: execution.thinking, ui: ctx.ui });
				renderJobs();
			}

			const deliver = (content: string, details: Record<string, unknown>, summary: string, level: "info" | "warning") => {
				if (!sessionActive) return;
				try {
					ctx.ui.notify(summary, level);
					const hasEditorDraft = ctx.mode === "tui"
						&& typeof ctx.ui.getEditorText === "function"
						&& ctx.ui.getEditorText().trim().length > 0;
					pi.sendMessage(
						{ customType: "subagent-result", content, display: true, details },
						hasEditorDraft ? { deliverAs: "nextTurn" } : { triggerTurn: false },
					);
				} catch (error) {
					console.error(`Could not deliver subagent job ${jobId}:`, error);
				}
			};

			void (async () => {
				try {
					const result = await runHeadlessSubagent({
						cwd,
						profile,
						model: execution.model,
						thinking: execution.thinking,
						files,
						promptFile,
						signal: controller.signal,
						timeoutMs: profile.timeoutMs,
						maxConcurrency: config.subagentDefaults?.maxConcurrency ?? 4,
						onUpdate: (progress) => {
							if (!sessionActive) return;
							const job = jobProgress.get(jobId);
							if (job) {
								job.progress = progress;
								renderJobs();
							}
						},
					});
					const usageSummary = `${profile.name}: ${result.status} · ${result.model ?? "default model"} · thinking: ${result.thinking ?? "default"} · ${result.usage.turns} turns · ${result.usage.input} input · ${result.usage.output} output · ${result.usage.cacheRead} cache-read tokens${result.usage.cost ? ` · $${result.usage.cost.toFixed(4)}` : ""}`;
					const output = result.output ? truncateUtf8(result.output) : result.error ?? "Subagent failed without output.";
					deliver(
						`Subagent job ${jobId} (${profile.name}) ${result.status}.\n\n${output}`,
						{ ...result, backend: "headless", profile: profile.name, jobId },
						usageSummary,
						result.status === "completed" ? "info" : "warning",
					);
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					deliver(
						`Subagent job ${jobId} (${profile.name}) failed.\n\n${message}`,
						{ backend: "headless", profile: profile.name, jobId, status: "failed", error: message },
						`${profile.name}: failed · ${message}`,
						"warning",
					);
				} finally {
					backgroundRuns.delete(jobId);
					const ui = jobProgress.get(jobId)?.ui;
					jobProgress.delete(jobId);
					if (sessionActive && ui) {
						if (jobProgress.size) renderJobs();
						else ui.setWidget("subagent-jobs", undefined);
					}
					await rm(tempDir, { recursive: true, force: true }).catch((error) => {
						console.error(`Could not clean up subagent job ${jobId}:`, error);
					});
				}
			})();
			return {
				content: [text(`Started headless subagent job ${jobId} (${profile.name}). It will run in the background and display its result when ready.`)],
				details: { backend: "headless", profile: profile.name, jobId, status: "running" },
			};
		},
	});
}
