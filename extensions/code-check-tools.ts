import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { discoverCodeChecks } from "../lib/code-check/discover.js";
import { formatCheckResult } from "../lib/code-check/format.js";
import { runParallelChecks } from "../lib/code-check/parallel.js";
import { runEslint } from "../lib/code-check/parsers/eslint.js";
import { runTsc } from "../lib/code-check/parsers/tsc.js";
import { runVitest } from "../lib/code-check/parsers/vitest.js";
import type { ToolName } from "../lib/code-check/types.js";

const toolNameType = Type.Union([
  Type.Literal("eslint"),
  Type.Literal("tsc"),
  Type.Literal("vitest"),
]);

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "code_check_discover",
    label: "Code Check Discovery",
    description: "Discover which code check tools are available in the current project",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx) {
      try {
        const cwd = ctx?.cwd ?? process.cwd();
        const { available, overrides } = await discoverCodeChecks(cwd);
        const text = available.length
          ? `Available code checks: ${available.join(", ")}`
          : "No code checks detected.";
        return {
          content: [{ type: "text", text }],
          details: { available, overrides },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: message }], isError: true, details: {} };
      }
    },
  });

  const singleToolParams = Type.Object({
    path: Type.Optional(Type.String({ description: "Path to scope the check (file or directory)" })),
  });

  pi.registerTool({
    name: "code_check_eslint",
    label: "Code Check: ESLint",
    description: "Run ESLint and return a concise summary of errors",
    parameters: singleToolParams,
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = ctx?.cwd ?? process.cwd();
        const { overrides } = await discoverCodeChecks(cwd);
        const result = await runEslint(cwd, params.path, overrides.eslint);
        return {
          content: [{ type: "text", text: formatCheckResult(result) }],
          details: result,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: message }], isError: true, details: {} };
      }
    },
  });

  pi.registerTool({
    name: "code_check_tsc",
    label: "Code Check: TypeScript",
    description: "Run tsc --noEmit and return a concise summary of errors",
    parameters: singleToolParams,
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = ctx?.cwd ?? process.cwd();
        const { overrides } = await discoverCodeChecks(cwd);
        const result = await runTsc(cwd, params.path, overrides.tsc);
        return {
          content: [{ type: "text", text: formatCheckResult(result) }],
          details: result,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: message }], isError: true, details: {} };
      }
    },
  });

  pi.registerTool({
    name: "code_check_vitest",
    label: "Code Check: Vitest",
    description: "Run Vitest and return a concise summary of test failures",
    parameters: singleToolParams,
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = ctx?.cwd ?? process.cwd();
        const { overrides } = await discoverCodeChecks(cwd);
        const result = await runVitest(cwd, params.path, overrides.vitest);
        return {
          content: [{ type: "text", text: formatCheckResult(result) }],
          details: result,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: message }], isError: true, details: {} };
      }
    },
  });

  pi.registerTool({
    name: "code_check_parallel",
    label: "Code Check: Parallel",
    description: "Run multiple code checks in parallel and return a combined summary",
    parameters: Type.Object({
      path: Type.Optional(Type.String({ description: "Path to scope eslint/vitest; tsc is filtered after" })),
      tools: Type.Optional(Type.Array(toolNameType, { description: "Tools to run; defaults to available checks" })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = ctx?.cwd ?? process.cwd();
        const results = await runParallelChecks({
          cwd,
          path: params.path,
          tools: params.tools as ToolName[] | undefined,
        });
        const text = results.map((r) => formatCheckResult(r)).join("\n");
        const passed = results.every((r) => r.pass);
        return {
          content: [
            { type: "text", text: `${passed ? "✅" : "❌"} code checks\n${text}` },
          ],
          details: { results },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: message }], isError: true, details: {} };
      }
    },
  });
}
