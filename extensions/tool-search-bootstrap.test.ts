import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import registerToolSearchBootstrap from "./tool-search-bootstrap.js";

function createApi(activeTools: string[] = []) {
  let sessionStart: (() => void) | undefined;
  const setActiveTools = vi.fn((names: string[]) => {
    activeTools = names;
  });
  const api = {
    on: vi.fn((event: string, handler: () => void) => {
      if (event === "session_start") sessionStart = handler;
    }),
    getActiveTools: vi.fn(() => activeTools),
    setActiveTools,
  } as unknown as ExtensionAPI;
  return { api, start: () => sessionStart?.(), setActiveTools };
}

describe("tool-search bootstrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.PI_ACP_DELEGATE_DEPTH;
  });

  it("activates tool_search on session start when missing", () => {
    const { api, start, setActiveTools } = createApi(["read", "bash"]);
    registerToolSearchBootstrap(api);
    start();
    expect(setActiveTools).toHaveBeenCalledWith(["read", "bash", "tool_search"]);
  });

  it("does nothing when tool_search is already active", () => {
    const { api, start, setActiveTools } = createApi(["tool_search"]);
    registerToolSearchBootstrap(api);
    start();
    expect(setActiveTools).not.toHaveBeenCalled();
  });

  it("does not automatically expand the tool loadout inside acp_delegate children", () => {
    process.env.PI_ACP_DELEGATE_DEPTH = "1";
    const { api, start, setActiveTools } = createApi(["read", "bash"]);
    registerToolSearchBootstrap(api);
    start();
    expect(setActiveTools).not.toHaveBeenCalled();
  });
});
