import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { TSchema } from "typebox";
import { runGh, runGhJson } from "./runner.js";

export interface ActionContext {
  cwd: string;
}

export interface TextResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type GhRunType = "json" | "text";

export interface GhActionHandler<P = Record<string, unknown>> {
  buildArgs: (params: P, ctx: ActionContext) => string[];
  runType: GhRunType;
  format: (result: unknown, params: P, ctx: ActionContext) => string;
}

export interface GhActionToolConfig<P = Record<string, unknown>> {
  name: string;
  label: string;
  description: string;
  parameters: TSchema;
  handlers: Record<string, GhActionHandler<P>>;
}

export function registerGhActionTool<P extends Record<string, unknown>>(
  pi: ExtensionAPI,
  config: GhActionToolConfig<P>,
): void {
  pi.registerTool({
    name: config.name,
    label: config.label,
    description: config.description,
    parameters: config.parameters,
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const typedParams = params as Record<string, unknown>;
        const cwd = ctx?.cwd ?? process.cwd();
        const action = typedParams.action as string;
        const handler = config.handlers[action];

        if (!handler) {
          return errorResult(new Error(`Unknown action: ${action}`));
        }

        const actionContext: ActionContext = { cwd };
        const args = handler.buildArgs(typedParams as P, actionContext);
        if (typedParams.repo) {
          args.push("--repo", typedParams.repo as string);
        }

        let result: unknown;
        if (handler.runType === "json") {
          result = await runGhJson(args, cwd);
        } else {
          const { stdout, stderr, exitCode } = await runGh(args, cwd);
          result = { stdout, stderr, exitCode };
        }

        const text = handler.format(result, typedParams as P, actionContext);
        return { content: [{ type: "text" as const, text }], details: {} };
      } catch (err) {
        return errorResult(err);
      }
    },
  });
}

function errorResult(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
    details: {},
  };
}
