import { NextResponse } from "next/server";
import { MARKETING_SKILLS_SEED } from "@/lib/marketing-skills-seed";

/**
 * Read-only prompt library for the booth microsite. No Firestore, no auth, no edit endpoint —
 * this project has no login layer. Content ships in code (lib/marketing-skills-seed.ts); to
 * change it, edit that file and redeploy.
 */
export async function GET() {
  return NextResponse.json({
    success: true,
    skills: MARKETING_SKILLS_SEED,
    source: "code" as const,
    count: MARKETING_SKILLS_SEED.length,
  });
}
