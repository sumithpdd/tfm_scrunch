import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { MARKETING_SKILLS_SEED } from "@/lib/marketing-skills-seed";
import { claudeSkillsZip, claudeSkillsZipFilename } from "@/lib/claude-skill";
import { SITE } from "@/lib/site-config";

export const maxDuration = 30;

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 4;
const hits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

function emailLooksValid(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&#39;";
    }
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) {
    return NextResponse.json(
      {
        success: false,
        error: "Email sending is not configured yet (RESEND_API_KEY and EMAIL_FROM).",
      },
      { status: 503 },
    );
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (isRateLimited(ip)) {
    return NextResponse.json(
      { success: false, error: "Too many emails from this device — try again in a minute." },
      { status: 429 },
    );
  }

  try {
    const body = (await request.json()) as {
      name?: string;
      email?: string;
      skillIds?: string[];
    };
    const name = body.name?.trim() ?? "";
    const to = body.email?.trim().toLowerCase() ?? "";
    const requested = Array.isArray(body.skillIds) ? body.skillIds.map((id) => String(id)) : [];
    const allowed = new Set(MARKETING_SKILLS_SEED.map((skill) => skill.skillId));
    const skills = MARKETING_SKILLS_SEED.filter((skill) => requested.includes(skill.skillId) && allowed.has(skill.skillId));

    if (!name || !emailLooksValid(to) || skills.length === 0) {
      return NextResponse.json(
        { success: false, error: "Name, email, and at least one skill are required." },
        { status: 400 },
      );
    }
    if (isRateLimited(`skills:${to}`)) {
      return NextResponse.json(
        { success: false, error: "That inbox already received skills recently." },
        { status: 429 },
      );
    }

    const zip = claudeSkillsZip(skills);
    const filename = claudeSkillsZipFilename();
    const list = skills
      .map((skill) => `<li><strong>${escapeHtml(skill.name.replace(/_/g, " "))}</strong> — ${escapeHtml(skill.description)}</li>`)
      .join("");

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to,
      ...(SITE.presenterEmail
        ? { cc: SITE.presenterEmail, replyTo: SITE.presenterEmail }
        : {}),
      subject: `Your ${SITE.productName} Claude marketing skills`,
      html: `<p>Hi ${escapeHtml(name)},</p>
<p>Here are the ${skills.length} AI marketing skill${skills.length === 1 ? "" : "s"} you picked at the ${escapeHtml(SITE.companyName)} + ${escapeHtml(SITE.productName)} stand. The zip is ready for Claude — each folder is a standard skill with a <code>SKILL.md</code>.</p>
<p><strong>Claude.ai:</strong> Settings → Capabilities → Skills → upload each folder and turn it on.</p>
<p><strong>Claude Code:</strong> copy each folder into <code>~/.claude/skills/</code> (or <code>%USERPROFILE%\\.claude\\skills\\</code> on Windows).</p>
<ul>${list}</ul>
<p>${escapeHtml(SITE.presenterName)}${SITE.presenterEmail ? `<br/>${escapeHtml(SITE.presenterEmail)}` : ""}</p>`,
      attachments: [
        {
          filename,
          content: Buffer.from(zip),
          contentType: "application/zip",
        },
      ],
    });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 502 });
    }

    return NextResponse.json({ success: true, count: skills.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
