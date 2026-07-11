import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { registerGhActionTool, type GhActionToolConfig } from "./tool.js";
import { formatWorkflowList } from "./format.js";

const WorkflowAction = Type.Union([Type.Literal("list"), Type.Literal("trigger")]);

interface WorkflowParams extends Record<string, unknown> {
  action: string;
  repo?: string;
  workflow?: string;
  ref?: string;
  field?: string;
  all?: boolean;
  limit?: number;
}

export const workflowToolConfig: GhActionToolConfig<WorkflowParams> = {
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
  handlers: {
    list: {
      runType: "json",
      buildArgs: (params) => {
        const args = [
          "workflow",
          "list",
          "--json",
          "id,name,state,path",
          "--limit",
          String(params.limit ?? 20),
        ];
        if (params.all) args.push("--all");
        return args;
      },
      format: (result) => formatWorkflowList(result as any[]),
    },
    trigger: {
      runType: "text",
      buildArgs: (params) => {
        if (!params.workflow) {
          throw new Error("workflow is required for trigger");
        }
        if (!params.ref) {
          throw new Error("ref is required for trigger");
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
        return args;
      },
      format: (result, params) => {
        const { stdout } = result as { stdout: string };
        return stdout || `Triggered workflow ${params.workflow} on ${params.ref}.`;
      },
    },
  },
};

export default function registerWorkflowTools(pi: ExtensionAPI) {
  registerGhActionTool<WorkflowParams>(pi, workflowToolConfig);
}
