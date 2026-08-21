import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const mocks = vi.hoisted(() => ({
  createHerdrPane: vi.fn(),
  runInPane: vi.fn(),
  zoomHerdrPane: vi.fn(),
  openHerdrPopup: vi.fn(),
}));

vi.mock("../lib/herdr.js", () => ({
  createHerdrPane: mocks.createHerdrPane,
  runInPane: mocks.runInPane,
  zoomHerdrPane: mocks.zoomHerdrPane,
  openHerdrPopup: mocks.openHerdrPopup,
}));

import registerHerdrStartTools from "./herdr-start-tools.js";

function createApi() {
  let tool: any;
  return {
    registerTool: vi.fn((definition: any) => {
      tool = definition;
    }),
    getTool: () => tool,
  } as unknown as ExtensionAPI & { getTool: () => any };
}

async function execute(api: ReturnType<typeof createApi>, params: Record<string, unknown>) {
  return api.getTool().execute("call-1", params, undefined, undefined, { cwd: "/caller" });
}

describe("herdr_start tool", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.createHerdrPane.mockResolvedValue({ paneId: "pane-1" });
    mocks.zoomHerdrPane.mockResolvedValue(undefined);
    mocks.runInPane.mockResolvedValue(undefined);
    mocks.openHerdrPopup.mockResolvedValue(undefined);
  });

  it("starts a command in a focused, zoomed pane", async () => {
    const api = createApi();
    registerHerdrStartTools(api);

    const result = await execute(api, {
      command: "nvim /tmp/plan.md",
      cwd: "/repo",
      label: "Plan review",
      zoomed: true,
    });

    expect(api.getTool().name).toBe("herdr_start");
    expect(mocks.createHerdrPane).toHaveBeenCalledWith(
      "pane",
      "Plan review",
      "/repo",
      undefined,
      true,
    );
    expect(mocks.zoomHerdrPane).toHaveBeenCalledWith("pane-1", true);
    expect(mocks.runInPane).toHaveBeenCalledWith("pane-1", "nvim /tmp/plan.md");
    expect(result.details).toEqual({
      paneId: "pane-1",
      command: "nvim /tmp/plan.md",
      cwd: "/repo",
      zoomed: true,
      popup: false,
    });
  });

  it("uses caller defaults without zooming", async () => {
    const api = createApi();
    registerHerdrStartTools(api);

    await execute(api, { command: "tail -f app.log" });

    expect(mocks.createHerdrPane).toHaveBeenCalledWith(
      "pane",
      "Command",
      "/caller",
      undefined,
      true,
    );
    expect(mocks.zoomHerdrPane).not.toHaveBeenCalled();
  });

  it("can create an unfocused pane", async () => {
    const api = createApi();
    registerHerdrStartTools(api);

    await execute(api, { command: "npm test", focus: false });

    expect(mocks.createHerdrPane).toHaveBeenCalledWith(
      "pane",
      "Command",
      "/caller",
      undefined,
      false,
    );
  });

  it("opens a focused 90% popup when popup is true", async () => {
    const api = createApi();
    registerHerdrStartTools(api);

    const result = await execute(api, {
      command: "glow -p /tmp/plan.md",
      cwd: "/repo",
      popup: true,
    });

    expect(mocks.openHerdrPopup).toHaveBeenCalledWith(
      "glow -p /tmp/plan.md",
      "/repo",
      { width: "90%", height: "90%", focus: true },
    );
    expect(mocks.createHerdrPane).not.toHaveBeenCalled();
    expect(mocks.zoomHerdrPane).not.toHaveBeenCalled();
    expect(mocks.runInPane).not.toHaveBeenCalled();
    expect(result.content[0].text).toContain("popup");
    expect(result.details).toEqual({
      command: "glow -p /tmp/plan.md",
      cwd: "/repo",
      zoomed: false,
      popup: true,
    });
  });
});
