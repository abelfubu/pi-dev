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

const singleToolParams = Type.Object({
  path: Type.Optional(Type.String({ description: "Path to scope the check (file or directory)" })),
});

type RunCheck = (cwd: string, path?: string, override?: string) => Promise<CheckResult>;

interface ToolDefinition {
  name: ToolName;
  label: string;
  description: string;
  run: RunCheck;
}

const toolDefinitions: ToolDefinition[] = [
  {
    name: "eslint",
    label: "Code Check: ESLint",
    description: "Run ESLint and return a concise summary of errors",
    run: runEslint,
  },
  {
    name: "tsc",
    label: "Code Check: TypeScript",
    description: "Run tsc --noEmit and return a concise summary of errors",
    run: runTsc,
  },
  {
    name: "vitest",
    label: "Code Check: Vitest",
    description: "Run Vitest and return a concise summary of test failures",
    run: runVitest,
  },
  {
    name: "cargo_check",
    label: "Code Check: Cargo Check",
    description: "Run cargo check and return a concise summary of compilation errors",
    run: runCargoCheck,
  },
  {
    name: "cargo_clippy",
    label: "Code Check: Cargo Clippy",
    description: "Run cargo clippy and return a concise summary of lint warnings and errors",
    run: runCargoClippy,
  },
  {
    name: "cargo_test",
    label: "Code Check: Cargo Test",
    description: "Run cargo test and return a concise summary of test failures",
    run: runCargoTest,
  },
];

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
  const availableSet = new Set(available);

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

  for (const def of toolDefinitions) {
    if (!availableSet.has(def.name)) continue;

    pi.registerTool({
      name: `code_check_${def.name}`,
      label: def.label,
      description: def.description,
      parameters: singleToolParams,
      async execute(_id, params, _signal, _onUpdate, ctx) {
        try {
          const projectCwd = ctx?.cwd ?? process.cwd();
          const { overrides } = await discoverCodeChecks(projectCwd);
          const result = await def.run(projectCwd, params.path, overrides[def.name]);
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
    description: `Run multiple code checks in parallel and return a combined summary. Available checks: ${availableChecksText}`,
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
