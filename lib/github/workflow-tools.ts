import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { runGh, runGhJson } from "./runner.js";
import { formatWorkflowList } from "./format.js";

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

const WorkflowAction = Type.Union([Type.Literal("list"), Type.Literal("trigger")]);

export default function registerWorkflowTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gh_workflow",
    label: "GitHub Actions Workflow",
    description: "Perform a GitHub Actions workflow operation: list or trigger",
    parameters: Type.Object({
      action: WorkflowAction,
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
      workflow: Type.Optional(
        Type.String({ description: "Workflow file name, ID, or name (trigger/list)" }),
      ),
      ref: Type.Optional(
        Type.String({ description: "Git ref (branch, tag, or SHA) (trigger)" }),
      ),
      field: Type.Optional(
        Type.String({ description: "Workflow input key=value, comma-separated (trigger)" }),
      ),
      all: Type.Optional(
        Type.Boolean({ description: "Include disabled workflows (list)", default: false }),
      ),
      limit: Type.Optional(
        Type.Number({ description: "Maximum number of workflows (list)", default: 20 }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const action = params.action as string;

        if (action === "list") {
          const args = [
            "workflow",
            "list",
            "--json",
            "id,name,state,path",
            "--limit",
            String((params.limit as number) ?? 20),
          ];
          if (params.all) args.push("--all");
          repoFlag(args, params.repo);

          const data = await runGhJson(args, cwd);
          return success(formatWorkflowList(data as any[]), { workflows: data });
        }

        if (action === "trigger") {
          if (!params.workflow) {
            return errorResult(new Error("workflow is required for trigger"));
          }
          if (!params.ref) {
            return errorResult(new Error("ref is required for trigger"));
          }
          const args = ["workflow", "run", params.workflow, "--ref", params.ref];
          if (params.field) {
            for (const f of params.field
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)) {
              args.push("--field", f);
            }
          }
          repoFlag(args, params.repo);

          const result = await runGh(args, cwd);
          return success(
            result.stdout || `Triggered workflow ${params.workflow} on ${params.ref}.`,
            { stdout: result.stdout },
          );
        }

        return errorResult(new Error(`Unknown workflow action: ${action}`));
      } catch (err) {
        return errorResult(err);
      }
    },
  });
}
