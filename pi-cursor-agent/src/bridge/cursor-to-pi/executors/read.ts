import type {
  ReadArgs,
  ReadResult,
} from "../../../__generated__/agent/v1/read_exec_pb";
import {
  ReadRejected,
  ReadResult as ReadResultClass,
} from "../../../__generated__/agent/v1/read_exec_pb";
import type { Executor } from "../../../vendor/agent-exec";
import type { PiToolContext } from "../local-resource-provider/types";

const PI_READ_REQUIRED_REASON =
  "Cursor native Read is disabled. Use mcp_pi-agent_read so the operation runs through Pi's read tool.";

function buildReadRejectedResult(path: string, reason: string): ReadResult {
  return new ReadResultClass({
    result: { case: "rejected", value: new ReadRejected({ path, reason }) },
  });
}

export class LocalReadExecutor implements Executor<ReadArgs, ReadResult> {
  private readonly ctx: PiToolContext;

  constructor(ctx: PiToolContext) {
    this.ctx = ctx;
  }

  async execute(_ctx: unknown, args: ReadArgs): Promise<ReadResult> {
    if (!this.ctx.getActiveTools().has("read")) {
      return buildReadRejectedResult(args.path, "Tool not available");
    }

    return buildReadRejectedResult(args.path, PI_READ_REQUIRED_REASON);
  }
}
