import type {
  WriteArgs,
  WriteResult,
} from "../../../__generated__/agent/v1/write_exec_pb";
import {
  WriteRejected,
  WriteResult as WriteResultClass,
} from "../../../__generated__/agent/v1/write_exec_pb";
import type { Executor } from "../../../vendor/agent-exec";
import type { PiToolContext } from "../local-resource-provider/types";

const PI_WRITE_REQUIRED_REASON =
  "Cursor native Write and StrReplace are disabled. Use mcp_pi-agent_edit for exact replacements or mcp_pi-agent_write for intentional whole-file writes.";

function buildWriteRejectedResult(path: string, reason: string): WriteResult {
  return new WriteResultClass({
    result: { case: "rejected", value: new WriteRejected({ path, reason }) },
  });
}

export class LocalWriteExecutor implements Executor<WriteArgs, WriteResult> {
  private readonly ctx: PiToolContext;

  constructor(ctx: PiToolContext) {
    this.ctx = ctx;
  }

  async execute(_ctx: unknown, args: WriteArgs): Promise<WriteResult> {
    if (!this.ctx.getActiveTools().has("write")) {
      return buildWriteRejectedResult(args.path, "Tool not available");
    }

    return buildWriteRejectedResult(args.path, PI_WRITE_REQUIRED_REASON);
  }
}
