import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Type } from "typebox";
import {
  createHerdrPane,
  notifyPane,
  runInPane,
  shellQuote,
} from "../lib/herdr.js";

const EXTENSION_PATH = fileURLToPath(import.meta.url);

function textContent(text: string): { type: "text"; text: string } {
  return { type: "text", text };
}

interface SubagentDetails {
  missing?: string[];
  profile?: string;
  pane?: string;
  tab?: string;
  resultFile?: string;
}

interface SubagentProfile {
  name: string;
  tools: string[];
  skills?: string[];
  model?: string;
  layout: "tab" | "pane";
}

const SUBAGENT_PROFILES: Record<string, SubagentProfile> = {
  reviewer: {
    name: "reviewer",
    tools: ["read", "grep", "write"],
    skills: ["code-review"],
    layout: "pane",
  },
  coder: {
    name: "coder",
    tools: ["read", "edit", "write", "bash"],
    layout: "pane",
  },
  scout: {
    name: "scout",
    tools: ["read", "grep", "find", "ls", "bash", "write"],
    layout: "pane",
  },
  minimal: {
    name: "minimal",
    tools: ["read", "write"],
    layout: "pane",
  },
};

function errorResult(message: string, details: SubagentDetails = {}) {
  return {
    content: [textContent(message)],
    isError: true as const,
    details,
  };
}

function resolveSkillPath(skillName: string): string {
  return join(getAgentDir(), "skills", skillName);
}

function buildSubagentPrompt(params: {
  task: string;
  profile: string;
  parentPaneId: string;
  resultFile: string;
}): string {
  return [
    `## Task`,
    params.task,
    ``,
    `## Subagent context`,
    `- Profile: ${params.profile}`,
    `- Parent pane: ${params.parentPaneId}`,
    `- Result file: ${params.resultFile}`,
    `- Environment variables: SUBAGENT_PARENT_PANE_ID, SUBAGENT_RESULT_FILE`,
    ``,
    `When you finish, write your final result to the result file, then call the subagent_done tool with:`,
    `- parent_pane_id: ${params.parentPaneId}`,
    `- result_file: ${params.resultFile}`,
    `- summary: a one-line summary of what you found or did`,
  ].join("\n");
}

const SubagentParams = Type.Object({
  profile: Type.String({
    description: "Subagent profile name: reviewer, coder, scout, or minimal",
  }),
  task: Type.String({
    description: "Markdown task for the subagent",
  }),
  files: Type.Optional(
    Type.Array(Type.String(), {
      description: "Files to attach with @file references (resolved relative to cwd)",
    }),
  ),
  cwd: Type.Optional(
    Type.String({
      description: "Working directory for the subagent; defaults to the current cwd",
    }),
  ),
  model: Type.Optional(
    Type.String({
      description: "Optional model/provider to pass to pi with --model",
    }),
  ),
});

const SubagentDoneParams = Type.Object({
  parent_pane_id: Type.Optional(
    Type.String({
      description:
        "Herdr pane ID of the parent session; falls back to SUBAGENT_PARENT_PANE_ID env var",
    }),
  ),
  result_file: Type.Optional(
    Type.String({
      description:
        "Absolute path to the result file the subagent wrote; falls back to SUBAGENT_RESULT_FILE env var",
    }),
  ),
  summary: Type.Optional(
    Type.String({
      description: "One-line summary of the result",
    }),
  ),
});

async function executeSubagent(
  _id: string,
  params: {
    profile: string;
    task: string;
    files?: string[];
    cwd?: string;
    model?: string;
  },
  _signal: AbortSignal | undefined,
  _onUpdate: unknown,
  ctx: { cwd?: string },
) {
  try {
    const cwd = resolve(params.cwd ?? ctx?.cwd ?? process.cwd());
    const profile = SUBAGENT_PROFILES[params.profile];
    if (!profile) {
      return errorResult(
        `Unknown profile: ${params.profile}. Available: ${Object.keys(SUBAGENT_PROFILES).join(", ")}.`,
      );
    }

    const files = (params.files ?? []).map((f) => resolve(cwd, f));
    const missing = files.filter((f) => !existsSync(f));
    if (missing.length > 0) {
      return errorResult(`Missing files: ${missing.join(", ")}`, { missing });
    }

    const skillPaths: string[] = [];
    if (profile.skills) {
      for (const skillName of profile.skills) {
        const skillPath = resolveSkillPath(skillName);
        if (!existsSync(join(skillPath, "SKILL.md"))) {
          return errorResult(`Skill not found: ${skillName}`, {
            profile: profile.name,
          });
        }
        skillPaths.push(skillPath);
      }
    }

    const resultDir = resolve(cwd, ".pi", "subagent-results");
    await mkdir(resultDir, { recursive: true });
    const resultFile = resolve(
      resultDir,
      `${profile.name}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.md`,
    );

    const parentPaneId = process.env.HERDR_PANE_ID;
    if (!parentPaneId) {
      return errorResult("Not running inside a Herdr-managed pane.");
    }

    const container = await createHerdrPane(profile.layout, profile.name, cwd);
    if (!container.paneId) {
      throw new Error("herdr did not return a pane id");
    }

    const piArgs: string[] = ["-ne", "-e", EXTENSION_PATH];
    for (const skillPath of skillPaths) {
      piArgs.push("--skill", skillPath);
    }
    piArgs.push("--tools", [...profile.tools, "subagent_done"].join(","));
    const model = params.model ?? profile.model;
    if (model) piArgs.push("--model", model);
    for (const file of files) {
      piArgs.push(`@${file}`);
    }
    piArgs.push(
      buildSubagentPrompt({
        task: params.task,
        profile: profile.name,
        parentPaneId,
        resultFile,
      }),
    );

    const envVars = [
      `SUBAGENT_PARENT_PANE_ID=${shellQuote(parentPaneId)}`,
      `SUBAGENT_RESULT_FILE=${shellQuote(resultFile)}`,
    ].join(" ");
    const command = `cd ${shellQuote(cwd)} && ${envVars} pi ${piArgs.map(shellQuote).join(" ")}`;
    await runInPane(container.paneId, command);

    return {
      content: [
        textContent(container.tabId
          ? `Subagent **${profile.name}** launched in tab **${container.tabId}**. Result will be written to ${resultFile}.`
          : `Subagent **${profile.name}** launched in pane **${container.paneId}**. Result will be written to ${resultFile}.`),
      ],
      details: { profile: profile.name, pane: container.paneId, tab: container.tabId, resultFile },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return errorResult(message);
  }
}

export default function (pi: ExtensionAPI) {
  if (process.env.HERDR_ENV !== "1") {
    return;
  }

  pi.registerTool({
    name: "herdr_handoff",
    label: "Herdr Handoff",
    description:
      "Open a new focused Herdr tab in the current workspace, start a fresh interactive pi session, and seed it with a prompt. Use when the user wants to hand off a slice of work to a separate interactive session, especially when they say things like 'hand off', 'new tab', or 'work on this in a fresh pi'.",
    parameters: Type.Object({
      title: Type.String({ description: "Title for the new Herdr tab" }),
      prompt: Type.String({
        description:
          "Markdown prompt to seed as the first input in the new pi session",
      }),
      files: Type.Optional(
        Type.Array(Type.String(), {
          description:
            "Optional files to attach with @file references (resolved relative to cwd)",
        }),
      ),
      cwd: Type.Optional(
        Type.String({
          description:
            "Working directory for the new pi session; defaults to the current cwd",
        }),
      ),
      model: Type.Optional(
        Type.String({
          description: "Optional model/provider to pass to pi with --model",
        }),
      ),
    }),
    async execute(_id, params, _signal, _onUpdate, ctx) {
      try {
        const cwd = resolve(
          params.cwd ??
          (ctx?.cwd as string | undefined) ??
          process.cwd(),
        );

        const files = (params.files ?? []).map((f) => resolve(cwd, f));
        const missing = files.filter((f) => !existsSync(f));
        if (missing.length > 0) {
          return {
            content: [
              textContent(`Missing files: ${missing.join(", ")}`),
            ],
            isError: true,
            details: { missing },
          };
        }

        const container = await createHerdrPane("tab", params.title, cwd);
        if (!container.paneId || !container.tabId) {
          throw new Error(
            `herdr tab create did not return tab/pane ids: ${JSON.stringify(container)}`,
          );
        }

        const piArgs: string[] = [];
        if (params.model) {
          piArgs.push("--model", shellQuote(params.model));
        }
        for (const file of files) {
          piArgs.push(shellQuote(`@${file}`));
        }
        piArgs.push(shellQuote(params.prompt));

        const command = `cd ${shellQuote(cwd)} && pi ${piArgs.join(" ")}`;
        await runInPane(container.paneId, command);

        return {
          content: [
            textContent(`Handed off to tab **${container.tabId}** (${params.title})`),
          ],
          details: {
            tab: container.tabId,
            pane: container.paneId,
            title: params.title,
          },
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [textContent(message)],
          isError: true,
          details: {},
        };
      }
    },
  });

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description:
      "Launch a specialized subagent in a new Herdr tab or pane. Profiles: reviewer, coder, scout, minimal. The subagent is restricted to a small tool/skill set and reports back via an artifact file.",
    parameters: SubagentParams,
    execute: executeSubagent,
  });

  pi.registerTool({
    name: "Agent",
    label: "Agent",
    description:
      "Alias for the subagent tool. Use when a skill or prompt refers to an Agent.",
    parameters: SubagentParams,
    execute: executeSubagent,
  });

  pi.registerTool({
    name: "subagent_done",
    label: "Subagent Done",
    description:
      "Notify the parent pane that this subagent has finished and the result file is ready to read.",
    parameters: SubagentDoneParams,
    async execute(_id, params) {
      const parentPaneId = params.parent_pane_id ?? process.env.SUBAGENT_PARENT_PANE_ID;
      const resultFile = params.result_file ?? process.env.SUBAGENT_RESULT_FILE;
      if (!parentPaneId || !resultFile) {
        return errorResult(
          "Missing parent_pane_id and result_file; no SUBAGENT_PARENT_PANE_ID or SUBAGENT_RESULT_FILE env vars found either.",
        );
      }
      const summary = params.summary ?? "done";
      await notifyPane(
        parentPaneId,
        `subagent done: ${resultFile} (${summary})`,
      );
      return {
        content: [
          textContent(`Notified parent pane ${parentPaneId}.`),
        ],
        details: {},
      };
    },
  });
}
