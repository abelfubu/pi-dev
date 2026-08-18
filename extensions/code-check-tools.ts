import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { discoverCodeChecks } from "../lib/code-check/discover.js";
import { formatCheckResult } from "../lib/code-check/format.js";
import { runCheck } from "../lib/code-check/runner.js";

export default async function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "code_check_list",
    label: "Code Checks: List",
    description: "List repository-owned verification commands discovered from configuration, package scripts, or Cargo",
    parameters: Type.Object({}),
    async execute(_id, _params, _signal, _onUpdate, ctx) {
      try {
        const cwd = ctx?.cwd ?? process.cwd();
        const { checks } = await discoverCodeChecks(cwd);
        const text = checks.length > 0
          ? checks.map((check) => `- ${check.name}: ${check.command} (${check.source})`).join("\n")
          : "No repository-owned code checks detected.";
        return { content: [{ type: "text", text }], details: { checks } };
      } catch (error) {
        return toolError(error);
      }
    },
  });

  pi.registerTool({
    name: "code_check",
    label: "Code Check",
    description: "Run repository-owned checks sequentially and return concise exit-code-based results. Runs all discovered checks when names is omitted.",
    parameters: Type.Object({
      names: Type.Optional(Type.Array(Type.String(), {
        description: "Check names to run; omit to run all discovered checks",
      })),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = ctx?.cwd ?? process.cwd();
        const { checks } = await discoverCodeChecks(cwd);
        const requested = params.names as string[] | undefined;
        const selected = requested?.length
          ? requested.map((name) => checks.find((check) => check.name === name)).filter((check) => check !== undefined)
          : checks;
        const unknown = requested?.filter((name) => !checks.some((check) => check.name === name)) ?? [];

        if (unknown.length > 0) {
          return {
            content: [{ type: "text", text: `Unknown code checks: ${unknown.join(", ")}` }],
            isError: true,
            details: { available: checks.map((check) => check.name) },
          };
        }
        if (selected.length === 0) {
          return {
            content: [{ type: "text", text: "No repository-owned code checks detected." }],
            isError: true,
            details: { checks: [] },
          };
        }

        const results = [];
        for (const check of selected) results.push(await runCheck(check, cwd));
        const passed = results.every((result) => result.pass);
        return {
          content: [{
            type: "text",
            text: `${passed ? "✅" : "❌"} code checks\n${results.map(formatCheckResult).join("\n")}`,
          }],
          details: { results },
        };
      } catch (error) {
        return toolError(error);
      }
    },
  });
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text" as const, text: message }], isError: true, details: {} };
}
