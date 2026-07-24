import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type, type TSchema } from "typebox";
import { discoverCodeChecks } from "../lib/code-check/discover.js";
import { formatCheckResult } from "../lib/code-check/format.js";
import { runParallelChecks } from "../lib/code-check/parallel.js";
import { runCargoCheck } from "../lib/code-check/parsers/cargo-check.js";
import { runCargoClippy } from "../lib/code-check/parsers/cargo-clippy.js";
import { runCargoTest } from "../lib/code-check/parsers/cargo-test.js";
import { runEslint } from "../lib/code-check/parsers/eslint.js";
import { runTsc } from "../lib/code-check/parsers/tsc.js";
import { runVitest } from "../lib/code-check/parsers/vitest.js";
import type { CheckResult, ToolName } from "../lib/code-check/types.js";

const runners: Record<ToolName, RunCheck> = {
  eslint: runEslint,
  tsc: runTsc,
  vitest: runVitest,
  cargo_check: runCargoCheck,
  cargo_clippy: runCargoClippy,
  cargo_test: runCargoTest,
};

type RunCheck = (cwd: string, path?: string, override?: string) => Promise<CheckResult>;

function buildNameSchema(available: ToolName[]): TSchema {
  const literals = available.map((name) => Type.Literal(name));
  return literals.length === 1
    ? literals[0]
    : Type.Union(literals, { description: "Code check to run" });
}

function buildParallelToolsSchema(available: ToolName[]): TSchema | undefined {
  if (available.length === 0) return undefined;
  const literals = available.map((name) => Type.Literal(name));
  const itemSchema = literals.length === 1 ? literals[0] : Type.Union(literals);
  return Type.Optional(
    Type.Array(itemSchema, { description: "Tools to run; defaults to available checks" })
  );
}

export default async function (pi: ExtensionAPI) {
  const cwd = process.cwd();
  const { available } = await discoverCodeChecks(cwd);

  pi.registerTool({
    name: "code_check_discover",
    label: "Code Check Discovery",
    description: "Discover which code check tools are available in the current project",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx) {
      try {
        const projectCwd = ctx?.cwd ?? process.cwd();
        const { available, overrides } = await discoverCodeChecks(projectCwd);
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

  if (available.length > 0) {
    pi.registerTool({
      name: "code_check",
      label: "Code Check",
      description: "Preferred replacement for an equivalent raw npm, npx, or cargo check. Run one code check and return a concise authoritative summary; do not rerun the same check after it passes.",
      parameters: Type.Object({
        name: buildNameSchema(available),
        path: Type.Optional(
          Type.String({
            description: "Path to scope the check (file or directory)",
          })
        ),
      }),
      async execute(_id, params, _signal, _onUpdate, ctx) {
        try {
          const projectCwd = ctx?.cwd ?? process.cwd();
          const { overrides } = await discoverCodeChecks(projectCwd);
          const name = params.name as ToolName;
          const run = runners[name];
          if (!run) {
            return {
              content: [{ type: "text", text: `Unknown code check: ${name}` }],
              isError: true,
              details: {},
            };
          }
          const result = await run(projectCwd, params.path as string | undefined, overrides[name]);
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
  }

  const toolsSchema = buildParallelToolsSchema(available);
  const parallelParamsShape: Record<string, TSchema> = {
    path: Type.Optional(
      Type.String({
        description:
          "Path to scope the check; project-wide results are filtered to the given path",
      })
    ),
  };
  if (toolsSchema) {
    parallelParamsShape.tools = toolsSchema;
  }
  const parallelParams = Type.Object(parallelParamsShape);

  const availableChecksText = available.length ? available.join(", ") : "none";

  pi.registerTool({
    name: "code_check_parallel",
    label: "Code Check: Parallel",
    description: `Preferred replacement for equivalent raw npm, npx, or cargo checks. Run checks in parallel and return an authoritative combined summary; do not rerun checks that pass. Available checks: ${availableChecksText}`,
    parameters: parallelParams,
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const projectCwd = ctx?.cwd ?? process.cwd();
        const results = await runParallelChecks({
          cwd: projectCwd,
          path: params.path as string | undefined,
          tools: params.tools as ToolName[] | undefined,
        });
        const text = results.map((r) => formatCheckResult(r)).join("\n");
        const passed = results.every((r) => r.pass);
        return {
          content: [{ type: "text", text: `${passed ? "✅" : "❌"} code checks\n${text}` }],
          details: { results },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: message }], isError: true, details: {} };
      }
    },
  });
}
