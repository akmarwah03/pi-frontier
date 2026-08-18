import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { ParsedPiContext } from "../../../src/bridge/pi-context/parser";
import { buildCursorRules } from "../../../src/bridge/pi-context/rules-builder";

async function withTempDir(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "pi-cursor-rules-test-"));
  try {
    await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function parsed(overrides: Partial<ParsedPiContext> = {}): ParsedPiContext {
  return { contextFiles: [], skills: [], cleanedPrompt: "", ...overrides };
}

test("context files become global rules, skills become agentFetched rules", async () => {
  await withTempDir(async (dir) => {
    const skillPath = join(dir, "SKILL.md");
    await writeFile(
      skillPath,
      "---\nname: s\ndescription: d\n---\nSkill body.",
    );

    const rules = await buildCursorRules(
      parsed({
        contextFiles: [{ path: "/AGENTS.md", content: "Agent rules." }],
        skills: [{ name: "s", description: "d", location: skillPath }],
      }),
    );

    assert.equal(rules.length, 3);
    assert.equal(rules[0]?.type?.type.case, "global");
    assert.match(rules[0]?.content ?? "", /mcp_pi-agent_read/);
    assert.match(rules[0]?.content ?? "", /mcp_pi-agent_edit/);
    assert.match(rules[0]?.content ?? "", /mcp_pi-agent_write/);
    assert.equal(rules[1]?.type?.type.case, "global");
    assert.equal(rules[1]?.content, "Agent rules.");
    assert.equal(rules[2]?.type?.type.case, "agentFetched");
    assert.equal(rules[2]?.content, "Skill body.");
    assert.ok(!rules[2]?.content.includes("---"));
  });
});

test("falls back to description when skill file is unreadable", async () => {
  const rules = await buildCursorRules(
    parsed({
      skills: [
        {
          name: "gone",
          description: "Skill description fallback.",
          location: "/nonexistent/SKILL.md",
        },
      ],
    }),
  );

  assert.equal(rules.length, 2);
  assert.equal(rules[1]?.type?.type.case, "agentFetched");
  assert.equal(rules[1]?.content, "Skill description fallback.");
});

test("adds Pi file-tool routing for empty context", async () => {
  const rules = await buildCursorRules(parsed());
  assert.equal(rules.length, 1);
  assert.equal(rules[0]?.fullPath, "<pi-file-tool-routing>");
  assert.match(rules[0]?.content ?? "", /Do not use Cursor native Read/);
});
