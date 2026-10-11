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
  const title = skill.name.replace(/_/g, " ");
  const tools = skill.tools.map((tool) => `- ${tool.name}`).join("\n");
  return `---
name: ${name}
description: ${yamlEscape(`${skill.description} Use when the user asks for ${skill.categoryLabel.toLowerCase()}, ${title.toLowerCase()}, AEO/GEO, or related marketing work.`)}
---

# ${title}

${skill.description}

## When to use

Trigger: ${skill.triggerLabel}.

Use this skill when the user wants this outcome in Claude — including Claude.ai custom skills and Claude Code.

## Tools

${tools || "- None required — Claude can run this from the instructions below."}

## How to run

1. Confirm the user goal in one sentence.
2. Collect any missing inputs (brand, URLs, keywords, dates).
3. Follow the instructions below in order.
4. Return a structured result the user can paste into a brief, sheet, or CMS.

## Instructions

${skill.systemPrompt.trim()}

## Output

Prefer tables or numbered lists. Flag assumptions. Do not invent live ranking or mention-rate numbers.
`;
}

export function claudeSkillsReadme(skills: MarketingSkillDoc[]): string {
  const list = skills
    .map((skill) => `- **${claudeSkillName(skill)}** — ${skill.description}`)
    .join("\n");
  return `# ${SITE.companyName} + ${SITE.productName} Claude skills

Each folder is a standard Claude skill: one \`SKILL.md\` that Claude.ai and Claude Code can load.

## Claude.ai (fastest)

1. Unzip this pack.
2. Open [claude.ai](https://claude.ai) → **Settings → Capabilities → Skills**.
3. Click **Upload skill**.
4. Choose **one skill folder** (the folder that contains \`SKILL.md\`), or zip that folder first if the picker wants a \`.zip\`.
5. Turn the skill on. Ask Claude to use it by name, e.g. “Use seo-keyword-monitor on these seed keywords”.

Repeat upload for each skill you want.

## Claude Code

\`\`\`bash
# macOS / Linux
mkdir -p ~/.claude/skills
cp -R seo-keyword-monitor ~/.claude/skills/

# Windows PowerShell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\\.claude\\skills"
Copy-Item -Recurse .\\seo-keyword-monitor "$env:USERPROFILE\\.claude\\skills\\"
\`\`\`

Then start a new Claude Code session. Skills in \`~/.claude/skills/\` are picked up automatically.

## Project-local (this repo)

Copy a skill folder into \`.claude/skills/\` in your project if you only want it for that codebase.

## Skills in this pack

${list}

Prepared by ${SITE.companyName} + ${SITE.productName}.
`;
}

export function claudeSkillFiles(skills: MarketingSkillDoc[]): { path: string; content: string }[] {
  return [
    { path: "README.md", content: claudeSkillsReadme(skills) },
    { path: "HOW_TO_INSTALL.md", content: claudeSkillsReadme(skills) },
    ...skills.map((skill) => ({
      path: `${claudeSkillName(skill)}/SKILL.md`,
      content: claudeSkillMarkdown(skill),
    })),
  ];
}

export function claudeSkillsZip(skills: MarketingSkillDoc[]): Uint8Array {
  return zipStore(claudeSkillFiles(skills));
}

export function claudeSingleSkillZip(skill: MarketingSkillDoc): Uint8Array {
  const name = claudeSkillName(skill);
  return zipStore([
    { path: `${name}/SKILL.md`, content: claudeSkillMarkdown(skill) },
    { path: `${name}/README.md`, content: claudeSkillsReadme([skill]) },
  ]);
}

export function claudeSkillsZipFilename(): string {
  return `${SITE.productName.toLowerCase()}-claude-marketing-skills.zip`;
}

export function claudeSingleSkillFilename(skill: MarketingSkillDoc): string {
  return `${claudeSkillName(skill)}.zip`;
}

export function downloadBytes(bytes: Uint8Array, filename: string) {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function yamlEscape(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ")}"`;
}
