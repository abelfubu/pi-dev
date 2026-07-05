import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { discoverCodeChecks } from "../lib/code-check/discover.js";
import { formatCheckResult } from "../lib/code-check/format.js";
import { runParallelChecks } from "../lib/code-check/parallel.js";
import { runCargoCheck } from "../lib/code-check/parsers/cargo-check.js";
import { runCargoClippy } from "../lib/code-check/parsers/cargo-clippy.js";
import { runCargoTest } from "../lib/code-check/parsers/cargo-test.js";
import { runEslint } from "../lib/code-check/parsers/eslint.js";
import { runTsc } from "../lib/code-check/parsers/tsc.js";
import { runVitest } from "../lib/code-check/parsers/vitest.js";
import type { ToolName } from "../lib/code-check/types.js";

const toolNameType = Type.Union([
  Type.Literal("eslint"),
  Type.Literal("tsc"),
  Type.Literal("vitest"),
  Type.Literal("cargo_check"),
  Type.Literal("cargo_clippy"),
  Type.Literal("cargo_test"),
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
    name: "code_check_cargo_check",
    label: "Code Check: Cargo Check",
    description: "Run cargo check and return a concise summary of compilation errors",
    parameters: singleToolParams,
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = ctx?.cwd ?? process.cwd();
        const { overrides } = await discoverCodeChecks(cwd);
        const result = await runCargoCheck(cwd, params.path, overrides.cargo_check);
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
    name: "code_check_cargo_clippy",
    label: "Code Check: Cargo Clippy",
    description: "Run cargo clippy and return a concise summary of lint warnings and errors",
    parameters: singleToolParams,
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = ctx?.cwd ?? process.cwd();
        const { overrides } = await discoverCodeChecks(cwd);
        const result = await runCargoClippy(cwd, params.path, overrides.cargo_clippy);
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
    name: "code_check_cargo_test",
    label: "Code Check: Cargo Test",
    description: "Run cargo test and return a concise summary of test failures",
    parameters: singleToolParams,
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = ctx?.cwd ?? process.cwd();
        const { overrides } = await discoverCodeChecks(cwd);
        const result = await runCargoTest(cwd, params.path, overrides.cargo_test);
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
      path: Type.Optional(Type.String({ description: "Path to scope the check; project-wide results are filtered to the given path" })),
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
