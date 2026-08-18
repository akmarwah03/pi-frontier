/** Convert parsed Pi context into CursorRule[] for Cursor's RequestContext.rules. */

import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import {
  CursorRule,
  CursorRuleType,
  CursorRuleTypeAgentFetched,
  CursorRuleTypeGlobal,
} from "../../__generated__/agent/v1/cursor_rules_pb";
import type { ParsedPiContext, PiSkillRef } from "./parser";

function parseFrontmatter(content: string): {
  frontmatter: Record<string, unknown>;
  body: string;
} {
  const s = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!s.startsWith("---")) return { frontmatter: {}, body: s };

  const end = s.indexOf("\n---", 3);
  if (end === -1) return { frontmatter: {}, body: s };

  const parsed = parseYaml(s.slice(4, end));
  return {
    frontmatter: (parsed ?? {}) as Record<string, unknown>,
    body: s.slice(end + 4).trim(),
  };
}

function globalRule(path: string, content: string): CursorRule {
  return new CursorRule({
    fullPath: path,
    content,
    type: new CursorRuleType({
      type: { case: "global", value: new CursorRuleTypeGlobal() },
    }),
  });
}

const PI_FILE_TOOL_RULE = globalRule(
  "<pi-file-tool-routing>",
  [
    "You are running inside Pi. For every file read, write, or edit, use the Pi MCP tools from provider pi-agent.",
    "Use mcp_pi-agent_read to inspect files, including its offset and limit arguments for large files.",
    "Use mcp_pi-agent_edit for exact replacements and mcp_pi-agent_write only to create or intentionally replace a whole file.",
    "Do not use Cursor native Read, Write, or StrReplace tools; those operations are disabled by the bridge.",
  ].join("\n"),
);

function agentFetchedRuleType(description: string): CursorRuleType {
  return new CursorRuleType({
    type: {
      case: "agentFetched",
      value: new CursorRuleTypeAgentFetched({ description }),
    },
  });
}

async function agentFetchedRule(skill: PiSkillRef): Promise<CursorRule> {
  try {
    const raw = await readFile(skill.location, "utf-8");
    const { body } = parseFrontmatter(raw);
    return new CursorRule({
      fullPath: skill.location,
      content: body || raw,
      type: agentFetchedRuleType(skill.description),
    });
  } catch {
    return new CursorRule({
      fullPath: skill.location,
      content: skill.description,
      type: agentFetchedRuleType(skill.description),
    });
  }
}

export async function buildCursorRules(
  parsed: ParsedPiContext,
): Promise<CursorRule[]> {
  const globals = parsed.contextFiles.map((f) => globalRule(f.path, f.content));
  const skills = await Promise.all(parsed.skills.map(agentFetchedRule));
  return [PI_FILE_TOOL_RULE, ...globals, ...skills];
}
