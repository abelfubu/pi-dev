import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { registerGhActionTool, type GhActionToolConfig } from "./tool.js";
import { formatRun, formatRunList } from "./format.js";

const RunAction = Type.Union([
  Type.Literal("list"),
  Type.Literal("view"),
  Type.Literal("rerun"),
]);

interface RunParams extends Record<string, unknown> {
  action: string;
  repo?: string;
  id?: string | number;
  job?: string | number;
  logFailed?: boolean;
  failed?: boolean;
  workflow?: string;
  branch?: string;
  status?: string;
  event?: string;
  limit?: number;
}

export const runToolConfig: GhActionToolConfig<RunParams> = {
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
  handlers: {
    list: {
      runType: "json",
      buildArgs: (params) => {
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
        return args;
      },
      format: (result) => formatRunList(result as any[]),
    },
    view: {
      runType: "text",
      buildArgs: (params) => {
        if (!params.id) {
          throw new Error("id is required for view");
        }
        if (params.logFailed) {
          const args = ["run", "view", String(params.id), "--log-failed"];
          if (params.job) args.push("--job", String(params.job));
          return args;
        }
        const args = [
          "run",
          "view",
          String(params.id),
          "--json",
          "databaseId,displayTitle,status,conclusion,workflowName,headBranch,createdAt,jobs",
        ];
        if (params.job) args.push("--job", String(params.job));
        return args;
      },
      format: (result, params) => {
        const { stdout } = result as { stdout: string };
        if (params.logFailed) {
          return stdout || "No failed log output.";
        }
        const data = stdout ? JSON.parse(stdout) : {};
        return formatRun(data);
      },
    },
    rerun: {
      runType: "text",
      buildArgs: (params) => {
        if (!params.id) {
          throw new Error("id is required for rerun");
        }
        const args = ["run", "rerun", String(params.id)];
        if (params.failed) args.push("--failed");
        return args;
      },
      format: (result, params) => {
        const { stdout } = result as { stdout: string };
        return stdout || `Rerun started for run ${params.id}.`;
      },
    },
  },
};

export default function registerRunTools(pi: ExtensionAPI) {
  registerGhActionTool<RunParams>(pi, runToolConfig);
}
