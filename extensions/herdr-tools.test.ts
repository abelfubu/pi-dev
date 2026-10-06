import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import register from "./herdr-tools.js";
import { closeHerdrPane, closeHerdrTab } from "../lib/herdr.js";

vi.mock("../lib/herdr.js", () => ({ closeHerdrPane: vi.fn(), closeHerdrTab: vi.fn() }));

function setup() {
  const registerTool = vi.fn();
  const on = vi.fn();
  register({ registerTool, on } as unknown as ExtensionAPI);
  return { registerTool, on, tool: registerTool.mock.calls[0][0] };
}

describe("Herdr terminal tools", () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it("only registers deferred herdr_close without delegation lifecycle hooks", () => {
    const { registerTool, on, tool } = setup();
    expect(registerTool).toHaveBeenCalledTimes(1);
    expect(tool.name).toBe("herdr_close");
    expect(tool.exposure).toBe("deferred");
    expect(on).not.toHaveBeenCalled();
  });

  it("closes a pane", async () => {
    const { tool } = setup();
    const result = await tool.execute("id", { pane: "pane-1" });
    expect(closeHerdrPane).toHaveBeenCalledWith("pane-1");
    expect(closeHerdrTab).not.toHaveBeenCalled();
    expect(result.content[0].text).toBe("Closed pane **pane-1**.");
  });

  it("closes a tab", async () => {
    const { tool } = setup();
    const result = await tool.execute("id", { tab: "tab-1" });
    expect(closeHerdrTab).toHaveBeenCalledWith("tab-1");
    expect(closeHerdrPane).not.toHaveBeenCalled();
    expect(result.content[0].text).toBe("Closed tab **tab-1**.");
  });

  it.each([{}, { pane: "pane-1", tab: "tab-1" }])("rejects invalid targets %j", async params => {
    const { tool } = setup();
    expect((await tool.execute("id", params)).isError).toBe(true);
    expect(closeHerdrPane).not.toHaveBeenCalled();
    expect(closeHerdrTab).not.toHaveBeenCalled();
  });

  it("reports close failures", async () => {
    vi.mocked(closeHerdrPane).mockRejectedValueOnce(new Error("close failed"));
    const { tool } = setup();
    const result = await tool.execute("id", { pane: "pane-1" });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("close failed");
  });
});
