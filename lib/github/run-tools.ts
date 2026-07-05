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

export default function registerRunTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gh_run_list",
    label: "GitHub Run List",
    description: "List GitHub Actions workflow runs",
    parameters: Type.Object({
      workflow: Type.Optional(Type.String({ description: "Filter by workflow file name or ID" })),
      branch: Type.Optional(Type.String({ description: "Filter by branch" })),
      status: Type.Optional(Type.String({ description: "Filter by status: queued, completed, in_progress, etc." })),
      event: Type.Optional(Type.String({ description: "Filter by event: push, pull_request, etc." })),
      limit: Type.Optional(Type.Number({ description: "Maximum number of runs", default: 10 })),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = [
          "run",
          "list",
          "--json",
          "databaseId,displayTitle,status,conclusion,workflowName,headBranch,event,createdAt",
          "--limit",
          String(params.limit ?? 10),
        ];

        if (params.workflow) args.push("--workflow", params.workflow);
        if (params.branch) args.push("--branch", params.branch);
        if (params.status) args.push("--status", params.status);
        if (params.event) args.push("--event", params.event);
        repoFlag(args, params.repo);

        const data = await runGhJson(args, cwd);
        return success(formatRunList(data as any[]), { runs: data });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_run_view",
    label: "GitHub Run View",
    description: "View a GitHub Actions workflow run",
    parameters: Type.Object({
      id: Type.Union([Type.String(), Type.Number()], {
        description: "Run ID",
      }),
      job: Type.Optional(Type.Union([Type.String(), Type.Number()], { description: "Job ID to focus on" })),
      logFailed: Type.Optional(
        Type.Boolean({ description: "Show log output for failed jobs", default: false }),
      ),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);

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
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_run_rerun",
    label: "GitHub Run Rerun",
    description: "Rerun a GitHub Actions workflow run",
    parameters: Type.Object({
      id: Type.Union([Type.String(), Type.Number()], {
        description: "Run ID",
      }),
      failed: Type.Optional(
        Type.Boolean({ description: "Rerun only failed jobs", default: false }),
      ),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["run", "rerun", String(params.id)];
        if (params.failed) args.push("--failed");
        repoFlag(args, params.repo);

        const result = await runGh(args, cwd);
        return success(result.stdout || `Rerun started for run ${params.id}.`, { stdout: result.stdout });
      } catch (err) {
        return errorResult(err);
      }
    },
  });
}
