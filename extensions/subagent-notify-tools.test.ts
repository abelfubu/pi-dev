import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const mocks = vi.hoisted(() => ({
  notifySubagentParent: vi.fn(),
  markSubagentCompletionSent: vi.fn(),
}));

vi.mock("../lib/subagent/notify.js", () => ({
  notifySubagentParent: mocks.notifySubagentParent,
  markSubagentCompletionSent: mocks.markSubagentCompletionSent,
  SubagentNotifyParams: {},
}));

import registerSubagentNotifyTools from "./subagent-notify-tools.js";

function createApi() {
  let tool: any;
  return {
    registerTool: vi.fn((definition: any) => {
      tool = definition;
    }),
    getTool: () => tool,
  } as unknown as ExtensionAPI & { getTool: () => any };
}

describe("subagent_notify tool", () => {
  beforeEach(() => {
    mocks.notifySubagentParent.mockReset();
    mocks.markSubagentCompletionSent.mockReset();
    delete process.env.SUBAGENT_RESULT_FILE;
  });

  it("registers as a direct tool so headless and herdr children can call it", () => {
    const api = createApi();
    registerSubagentNotifyTools(api);
    expect(api.getTool().name).toBe("subagent_notify");
    expect(api.getTool().exposure ?? "direct").toBe("direct");
  });

  it("fails when no result file is available", async () => {
    const api = createApi();
    registerSubagentNotifyTools(api);
    const result = await api.getTool().execute("call-1", {}, undefined);
    expect(result.isError).toBe(true);
    expect(mocks.notifySubagentParent).not.toHaveBeenCalled();
  });

  it("notifies the parent and marks completion sent", async () => {
    mocks.notifySubagentParent.mockResolvedValue({ transport: "socket" });
    const api = createApi();
    registerSubagentNotifyTools(api);
    const result = await api.getTool().execute("call-1", { result_file: "/tmp/result.md" }, undefined);
    expect(result.isError).toBeUndefined();
    expect(mocks.notifySubagentParent).toHaveBeenCalledWith(
      expect.objectContaining({ type: "done", resultFile: "/tmp/result.md" }),
    );
    expect(mocks.markSubagentCompletionSent).toHaveBeenCalled();
  });
});
