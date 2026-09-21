import type { MarketingSkillDoc } from "@/lib/marketing-skills-types";
import { SITE } from "@/lib/site-config";
import { zipStore } from "@/lib/zip-store";

export function claudeSkillName(skill: MarketingSkillDoc): string {
  return (skill.slug || skill.skillId)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function claudeSkillMarkdown(skill: MarketingSkillDoc): string {
  const name = claudeSkillName(skill);
  const tools = skill.tools.map((tool) => `- ${tool.name}`).join("\n");
  return `---
name: ${name}
description: ${yamlEscape(skill.description)} Use when the user asks for ${skill.categoryLabel.toLowerCase()}, ${skill.name.replace(/_/g, " ").toLowerCase()}, or related marketing work.
---

# ${skill.name.replace(/_/g, " ")}

${skill.description}

## When to use

Trigger: ${skill.triggerLabel}. Apply this skill when the user wants this outcome in Claude.

## Tools

${tools || "- None required — Claude can run this from the instructions below."}

## Instructions

${skill.systemPrompt.trim()}
`;
}

export function claudeSkillsReadme(skills: MarketingSkillDoc[]): string {
  const list = skills.map((skill) => `- **${claudeSkillName(skill)}** — ${skill.description}`).join("\n");
  return `# ${SITE.companyName} + ${SITE.productName} Claude skills

These folders are ready to drop into Claude. Each one is a standard \`SKILL.md\` agent skill.

## Add them to Claude.ai

1. Unzip this pack.
2. Open Claude → Settings → Capabilities → Skills.
3. Upload each skill folder (the folder that contains \`SKILL.md\`).
4. Turn the skill on, then ask Claude to use it by name.

## Add them to Claude Code

Copy each skill folder into \`~/.claude/skills/\` (macOS/Linux) or \`%USERPROFILE%\\.claude\\skills\\\` (Windows), then start a new Claude Code session.

## Skills in this pack

${list}

Prepared at the ${SITE.companyName} + ${SITE.productName} stand, ${SITE.eventName}.
`;
}

export function claudeSkillFiles(skills: MarketingSkillDoc[]): { path: string; content: string }[] {
  return [
    { path: "README.md", content: claudeSkillsReadme(skills) },
    ...skills.map((skill) => ({
      path: `${claudeSkillName(skill)}/SKILL.md`,
      content: claudeSkillMarkdown(skill),
    })),
  ];
}

export function claudeSkillsZip(skills: MarketingSkillDoc[]): Uint8Array {
  return zipStore(claudeSkillFiles(skills));
}

export function claudeSkillsZipFilename(): string {
  return `${SITE.productName.toLowerCase()}-claude-marketing-skills.zip`;
}

function yamlEscape(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
}
