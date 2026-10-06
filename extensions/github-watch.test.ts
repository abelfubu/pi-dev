import { it, expect, vi, afterEach } from "vitest";
import register from "./github-watch.js";
import * as client from "../lib/github-watch/client.js";
vi.mock("../lib/github-watch/client.js", () => ({ request: vi.fn(), listen: vi.fn() }));
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
function setup() {
  const handlers = new Map<string, Function>();
  const registerTool = vi.fn(), sendMessage = vi.fn(), close = vi.fn();
  vi.mocked(client.listen).mockReturnValue(close);
  vi.mocked(client.request).mockResolvedValue({ ok: true });
  register({ on: (name: string, handler: Function) => handlers.set(name, handler), registerTool, sendMessage } as never);
  handlers.get("session_start")!({}, { sessionManager: { getSessionId: () => "session-one" } });
  const receive = vi.mocked(client.listen).mock.calls[0][1];
  const expire = vi.mocked(client.listen).mock.calls[0][3]!;
  const tool = registerTool.mock.calls[0][0];
  return { handlers, sendMessage, close, receive, expire, tool };
}
it("does not connect or manage subscriptions inside ACP delegates", async () => {
  vi.stubEnv("PI_ACP_DELEGATE_DEPTH", "1");
  const handlers = new Map<string, Function>();
  const registerTool = vi.fn();
  register({ on: (name: string, handler: Function) => handlers.set(name, handler), registerTool, sendMessage: vi.fn() } as never);
  handlers.get("session_start")!({}, { sessionManager: { getSessionId: () => "delegate-session" } });
  expect(client.listen).not.toHaveBeenCalled();
  const tool = registerTool.mock.calls[0][0];
  await expect(tool.execute("watch", { action: "watch", repo: "org/server", pr: 742 })).rejects.toThrow(
    "GitHub subscriptions are owned by the parent orchestrator",
  );
  expect(client.request).not.toHaveBeenCalled();
  handlers.get("session_shutdown")!();
});
it("coalesces follow-ups and acknowledging an old revision preserves newer work", async () => {
  const { receive, tool, sendMessage, handlers } = setup();
  const event = { type: "changed" as const, repo: "org/server", pr: 742, revision: 1 };
  receive(event); receive({ ...event, revision: 2 });
  expect(sendMessage).toHaveBeenCalledTimes(1);
  expect(sendMessage.mock.calls[0][1]).toEqual({ triggerTurn: true, deliverAs: "followUp" });
  await tool.execute("ack", { action: "ack", repo: event.repo, pr: event.pr, revision: 1 });
  expect(sendMessage).toHaveBeenCalledTimes(2);
  expect(sendMessage.mock.calls[1][0].details.revision).toBe(2);
  expect(vi.mocked(client.request).mock.calls.at(-1)?.[0]).toMatchObject({ consumer: "pi:session-one" });
  handlers.get("session_shutdown")!();
});
it("suppresses in-transit notifications after cancellation and stale lifecycle callbacks", async () => {
  const { receive, tool, sendMessage, handlers, close } = setup();
  const event = { type: "changed" as const, repo: "org/server", pr: 742, revision: 1 };
  await tool.execute("cancel", { action: "cancel", repo: event.repo, pr: event.pr });
  receive(event);
  expect(sendMessage).not.toHaveBeenCalled();
  await tool.execute("watch", { action: "watch", repo: event.repo, pr: event.pr });
  receive(event);
  expect(sendMessage).toHaveBeenCalledTimes(1);
  handlers.get("session_shutdown")!();
  receive({ ...event, revision: 2 });
  expect(sendMessage).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalled();
});
it("reports lease expiry without starting an agent turn", () => {
  const { expire, sendMessage, handlers } = setup();
  expire({ repo: "org/server", pr: 742 });
  expect(sendMessage.mock.calls[0][1]).toEqual({ triggerTurn: false });
  handlers.get("session_shutdown")!();
});
it("rejects already aborted operations before starting the service", async () => {
  const { tool, handlers } = setup();
  const controller = new AbortController(); controller.abort();
  await expect(tool.execute("watch", { action: "watch", repo: "org/server", pr: 742 }, controller.signal)).rejects.toThrow();
  expect(client.request).not.toHaveBeenCalled();
  handlers.get("session_shutdown")!();
});
