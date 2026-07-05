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

export default function registerWorkflowTools(pi: ExtensionAPI) {
  pi.registerTool({
    name: "gh_workflow_list",
    label: "GitHub Workflow List",
    description: "List GitHub Actions workflows",
    parameters: Type.Object({
      all: Type.Optional(Type.Boolean({ description: "Include disabled workflows", default: false })),
      limit: Type.Optional(Type.Number({ description: "Maximum number of workflows", default: 20 })),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["workflow", "list", "--json", "id,name,state,path", "--limit", String(params.limit ?? 20)];
        if (params.all) args.push("--all");
        repoFlag(args, params.repo);

        const data = await runGhJson(args, cwd);
        return success(formatWorkflowList(data as any[]), { workflows: data });
      } catch (err) {
        return errorResult(err);
      }
    },
  });

  pi.registerTool({
    name: "gh_workflow_trigger",
    label: "GitHub Workflow Trigger",
    description: "Trigger a GitHub Actions workflow dispatch",
    parameters: Type.Object({
      workflow: Type.String({ description: "Workflow file name, ID, or name" }),
      ref: Type.String({ description: "Git ref (branch, tag, or SHA)" }),
      field: Type.Optional(Type.String({ description: "Workflow input key=value (comma-separated for multiple)" })),
      repo: Type.Optional(Type.String({ description: "Repository as OWNER/NAME" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = getCwd(ctx);
        const args = ["workflow", "run", params.workflow, "--ref", params.ref];

        if (params.field) {
          for (const f of params.field.split(",").map((s) => s.trim()).filter(Boolean)) {
            args.push("--field", f);
          }
        }
        repoFlag(args, params.repo);

        const result = await runGh(args, cwd);
        return success(result.stdout || `Triggered workflow ${params.workflow} on ${params.ref}.`, {
          stdout: result.stdout,
        });
      } catch (err) {
        return errorResult(err);
      }
    },
  });
}
