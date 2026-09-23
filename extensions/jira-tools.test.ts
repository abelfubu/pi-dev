import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const mocks = vi.hoisted(() => ({
  loadConfig: vi.fn(),
  runAcliJson: vi.fn(),
}));
vi.mock("../lib/config.js", () => ({ loadConfig: mocks.loadConfig }));
vi.mock("../lib/runner.js", () => ({ runAcliJson: mocks.runAcliJson }));

import registerJiraTools from "./jira-tools.js";

function createApi() {
  let tool: any;
  return {
    registerTool: vi.fn((definition: any) => { tool = definition; }),
    getTool: () => tool,
  } as unknown as ExtensionAPI & { getTool: () => any };
}

async function execute(params: Record<string, unknown>) {
  const api = createApi();
  registerJiraTools(api);
  return api.getTool().execute("call-1", params, undefined, undefined, { cwd: "/repo" });
}

const parent = { key: "ITA-1", fields: { summary: "Parent" } };
const issue = {
  key: "ITA-2",
  fields: {
    summary: "Child",
    status: { name: "Open" },
    issuetype: { name: "Subtarea" },
  },
};

const issueTypes = [
  { name: "Historia", hierarchyLevel: 0, subtask: false },
  { name: "Tarea", hierarchyLevel: 0, subtask: false },
  { name: "Subtarea", hierarchyLevel: -1, subtask: true },
];

describe("jira tool", () => {
  beforeEach(() => {
    mocks.loadConfig.mockReset();
    mocks.runAcliJson.mockReset();
    mocks.loadConfig.mockResolvedValue({});
  });

  it("accepts ACLI's array search response", async () => {
    mocks.runAcliJson.mockResolvedValue([issue]);

    const result = await execute({ action: "search", jql: "project = ITA" });

    expect(result.details.issues).toEqual([issue]);
    expect(result.content[0].text).toContain("ITA-2");
  });

  it("retrieves search fields that ACLI only supports through view", async () => {
    mocks.runAcliJson
      .mockRejectedValueOnce(new Error("acli failed: Error: field 'parent' is not allowed"))
      .mockResolvedValueOnce([issue])
      .mockResolvedValueOnce({ ...issue, fields: { parent } });

    const result = await execute({
      action: "search",
      jql: "parent = ITA-1",
      fields: "key,summary,parent",
    });

    expect(mocks.runAcliJson).toHaveBeenNthCalledWith(2, expect.arrayContaining([
      "--fields", "key,summary",
    ]));
    expect(mocks.runAcliJson).toHaveBeenNthCalledWith(3, expect.arrayContaining([
      "--fields", "key,parent",
    ]));
    expect(result.details.issues[0].fields.parent).toEqual(parent);
  });

  it("maps a configured semantic issue type before creation", async () => {
    mocks.loadConfig.mockResolvedValue({
      jira: { projects: { ITA: { issueTypes: { task: "Tarea" } } } },
    });
    mocks.runAcliJson
      .mockResolvedValueOnce({ issueTypes })
      .mockResolvedValueOnce({ key: "ITA-3" });

    const result = await execute({
      action: "create",
      project: "ITA",
      type: "task",
      summary: "Do work",
    });

    expect(mocks.loadConfig).toHaveBeenCalledWith("/repo");
    expect(mocks.runAcliJson).toHaveBeenNthCalledWith(2, expect.arrayContaining([
      "--type", "Tarea",
    ]));
    expect(result.content[0].text).toContain("ITA-3");
  });

  it("discovers the project's subtask type without configuration", async () => {
    mocks.runAcliJson
      .mockResolvedValueOnce({ issueTypes })
      .mockResolvedValueOnce({ key: "ITA-3" });

    await execute({
      action: "create",
      project: "ITA",
      type: "subtask",
      parent: "ITA-1",
      summary: "Child",
    });

    expect(mocks.runAcliJson).toHaveBeenNthCalledWith(2, expect.arrayContaining([
      "--type", "Subtarea", "--summary", "Child", "--parent", "ITA-1",
    ]));
  });

  it("reports configured aliases and project types for an unknown type", async () => {
    mocks.loadConfig.mockResolvedValue({
      jira: { projects: { ITA: { issueTypes: { task: "Tarea" } } } },
    });
    mocks.runAcliJson.mockResolvedValueOnce({ issueTypes });

    const result = await execute({
      action: "create",
      project: "ITA",
      type: "feature",
      summary: "Unknown",
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown Jira issue type "feature"');
    expect(result.content[0].text).toContain("Configured aliases: task");
  });
});
