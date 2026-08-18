import assert from "node:assert/strict";
import test from "node:test";
import { ReadArgs } from "../../../src/__generated__/agent/v1/read_exec_pb";
import { LocalReadExecutor } from "../../../src/bridge/cursor-to-pi/executors/read";
import type { PiToolContext } from "../../../src/bridge/cursor-to-pi/local-resource-provider/types";

function createContext(activeTools: string[]): PiToolContext {
  return {
    cwd: "/tmp",
    getActiveTools: () => new Set(activeTools),
    getCtx: () => null,
  };
}

test("rejects Cursor native Read and routes the model to Pi read", async () => {
  const executor = new LocalReadExecutor(createContext(["read"]));
  const result = await executor.execute(
    null,
    new ReadArgs({ path: "/tmp/large.txt", toolCallId: "read-1" }),
  );

  assert.equal(result.result.case, "rejected");
  if (result.result.case !== "rejected") return;
  assert.equal(result.result.value.path, "/tmp/large.txt");
  assert.match(result.result.value.reason, /mcp_pi-agent_read/);
});

test("reports unavailable when Pi read is inactive", async () => {
  const executor = new LocalReadExecutor(createContext([]));
  const result = await executor.execute(
    null,
    new ReadArgs({ path: "/tmp/file.txt", toolCallId: "read-2" }),
  );

  assert.equal(result.result.case, "rejected");
  if (result.result.case !== "rejected") return;
  assert.equal(result.result.value.reason, "Tool not available");
});
