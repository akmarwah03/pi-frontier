import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { WriteArgs } from "../../../src/__generated__/agent/v1/write_exec_pb";
import { LocalWriteExecutor } from "../../../src/bridge/cursor-to-pi/executors/write";
import type { PiToolContext } from "../../../src/bridge/cursor-to-pi/local-resource-provider/types";

function createContext(activeTools: string[]): PiToolContext {
  return {
    cwd: "/tmp",
    getActiveTools: () => new Set(activeTools),
    getCtx: () => null,
  };
}

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "pi-cursor-write-test-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test("rejects Cursor native Write and StrReplace before Pi write", async () => {
  const executor = new LocalWriteExecutor(createContext(["write"]));
  const result = await executor.execute(
    null,
    new WriteArgs({
      path: "/tmp/large.txt",
      fileText: "partial file contents",
      toolCallId: "write-1",
    }),
  );

  assert.equal(result.result.case, "rejected");
  if (result.result.case !== "rejected") return;
  assert.equal(result.result.value.path, "/tmp/large.txt");
  assert.match(result.result.value.reason, /mcp_pi-agent_edit/);
  assert.match(result.result.value.reason, /mcp_pi-agent_write/);
});

test("keeps a large file intact when Cursor StrReplace submits a partial snapshot", async () => {
  await withTempDir(async (dir) => {
    const path = join(dir, "large.txt");
    const original = `${Array.from(
      { length: 2500 },
      (_, index) => `LINE-${String(index + 1).padStart(4, "0")}`,
    ).join("\n")}\n`;
    await writeFile(path, original);

    const executor = new LocalWriteExecutor(createContext(["write"]));
    const result = await executor.execute(
      null,
      new WriteArgs({
        path,
        fileText: `${original.split("\n").slice(0, 1000).join("\n")}\n[Output truncated]`,
        toolCallId: "write-large",
      }),
    );

    assert.equal(result.result.case, "rejected");
    assert.equal(await readFile(path, "utf8"), original);
  });
});

test("rejects Cursor native binary writes", async () => {
  const executor = new LocalWriteExecutor(createContext(["write"]));
  const result = await executor.execute(
    null,
    new WriteArgs({
      path: "/tmp/image.bin",
      fileBytes: new Uint8Array([0, 1, 2, 3]),
      toolCallId: "write-binary",
    }),
  );

  assert.equal(result.result.case, "rejected");
  if (result.result.case !== "rejected") return;
  assert.match(result.result.value.reason, /Cursor native Write/);
});

test("reports unavailable when Pi write is inactive", async () => {
  const executor = new LocalWriteExecutor(createContext([]));
  const result = await executor.execute(
    null,
    new WriteArgs({
      path: "/tmp/file.txt",
      fileText: "contents",
      toolCallId: "write-2",
    }),
  );

  assert.equal(result.result.case, "rejected");
  if (result.result.case !== "rejected") return;
  assert.equal(result.result.value.reason, "Tool not available");
});
