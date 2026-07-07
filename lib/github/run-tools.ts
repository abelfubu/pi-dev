import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runGh, runGhJson } from "./runner.js";
import { formatRun, formatRunList } from "./format.js";

function getCwd(ctx?: { cwd?: string }): string {
  return ctx?.cwd ?? process.cwd();
}

function repoFlag(args: string[], repo?: string): void {
  if (repo) args.push("--repo", repo);
}

function success(text: string, details?: Record<string, unknown>) {
  return { content: [{ type: "text" as const, text }], details: details ?? {} };
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return { content: [{ type: "text" as const, text: message }], isError: true as const, details: {} };
}

const RunAction = Type.Union([
  Type.Literal("list"),
  Type.Literal("view"),
  Type.Literal("rerun"),
]);

export default function registerRunTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gh_run",
    label: "GitHub Actions Run",
    description: "Perform a GitHub Actions workflow run operation: list, view, or rerun",
    parameters: Type.Object({
      action: RunAction,
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
      id: Type.Optional(
        Type.Union([Type.String(), Type.Number()], { description: "Run ID (view/rerun)" }),
      ),
      job: Type.Optional(
        Type.Union([Type.String(), Type.Number()], { description: "Job ID to focus on (view)" }),
      ),
      logFailed: Type.Optional(
        Type.Boolean({
          description: "Show log output for failed jobs (view)",
          default: false,
        }),
      ),
      failed: Type.Optional(
        Type.Boolean({
          description: "Rerun only failed jobs (rerun)",
          default: false,
        }),
      ),
      workflow: Type.Optional(
        Type.String({ description: "Filter by workflow file name or ID (list)" }),
      ),
      branch: Type.Optional(Type.String({ description: "Filter by branch (list)" })),
      status: Type.Optional(
        Type.String({ description: "Filter by status: queued, completed, in_progress, etc. (list)" }),
      ),
      event: Type.Optional(
        Type.String({ description: "Filter by event: push, pull_request, etc. (list)" }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Maximum number of runs (list)", default: 10 }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const action = params.action as string;

        if (action === "list") {
          const args = [
            "run",
            "list",
            "--json",
            "databaseId,displayTitle,status,conclusion,workflowName,headBranch,event,createdAt",
            "--limit",
            String((params.limit as number) ?? 10),
          ];
          if (params.workflow) args.push("--workflow", params.workflow);
          if (params.branch) args.push("--branch", params.branch);
          if (params.status) args.push("--status", params.status);
          if (params.event) args.push("--event", params.event);
          repoFlag(args, params.repo);

          const data = await runGhJson(args, cwd);
          return success(formatRunList(data as any[]), { runs: data });
        }

        if (action === "view") {
          if (!params.id) {
            return errorResult(new Error("id is required for view"));
          }
          if (params.logFailed) {
            const args = ["run", "view", String(params.id), "--log-failed"];
            if (params.job) args.push("--job", String(params.job));
            repoFlag(args, params.repo);
            const result = await runGh(args, cwd);
            return success(result.stdout || "No failed log output.", { stdout: result.stdout });
          }
          const args = [
            "run",
            "view",
            String(params.id),
            "--json",
            "databaseId,displayTitle,status,conclusion,workflowName,headBranch,createdAt,jobs",
          ];
          if (params.job) args.push("--job", String(params.job));
          repoFlag(args, params.repo);

          const data = await runGhJson(args, cwd);
          return success(formatRun(data), { run: data });
        }

        if (action === "rerun") {
          if (!params.id) {
            return errorResult(new Error("id is required for rerun"));
          }
          const args = ["run", "rerun", String(params.id)];
          if (params.failed) args.push("--failed");
          repoFlag(args, params.repo);

          const result = await runGh(args, cwd);
          return success(result.stdout || `Rerun started for run ${params.id}.`, {
            stdout: result.stdout,
          });
        }

        return errorResult(new Error(`Unknown run action: ${action}`));
      } catch (err) {
        return errorResult(err);
      }
    },
  });
}
