import "server-only";
import type {
  ScrunchCompetitorDiffItem,
  ScrunchConnectDiff,
  ScrunchDescriptionDiff,
  ScrunchPersonaDiffItem,
  ScrunchTopicDiffItem,
} from "@/lib/scrunch-diff-types";
import type { ScrunchLiveSnapshot } from "@/lib/scrunch-live-types";
import type {
  ScrunchBrandSetupDoc,
  ScrunchCompetitor,
  ScrunchPersona,
  ScrunchTopic,
} from "@/lib/scrunch-setup-types";

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function emptyDiff(message: string, configured: boolean): ScrunchConnectDiff {
  return {
    configured,
    message,
    brandId: null,
    brandName: null,
    website: null,
    description: { status: "empty", sheet: "", live: "" },
    personas: [],
    competitors: [],
    topics: [],
    counts: {
      personasMissing: 0,
      personasOnlyLive: 0,
      personasChanged: 0,
      competitorsMissing: 0,
      competitorsOnlyLive: 0,
      topicsMissing: 0,
      topicsOnlyLive: 0,
    },
  };
}

function descriptionDiff(sheet: string, live: string): ScrunchDescriptionDiff {
  const a = sheet.trim();
  const b = live.trim();
  if (!a && !b) return { status: "empty", sheet: a, live: b };
  if (a && !b) return { status: "missing_in_scrunch", sheet: a, live: b };
  if (!a && b) return { status: "only_in_scrunch", sheet: a, live: b };
  if (norm(a) === norm(b)) return { status: "matched", sheet: a, live: b };
  return { status: "changed", sheet: a, live: b };
}

function diffPersonas(
  sheet: ScrunchPersona[],
  live: ScrunchLiveSnapshot["personas"],
): ScrunchPersonaDiffItem[] {
  const liveBy = new Map(live.map((p) => [norm(p.name), p]));
  const sheetBy = new Map(sheet.map((p) => [norm(p.name), p]));
  const keys = new Set([...sheetBy.keys(), ...liveBy.keys()]);
  const out: ScrunchPersonaDiffItem[] = [];
  for (const key of keys) {
    const s = sheetBy.get(key);
    const l = liveBy.get(key);
    if (s && l) {
      const changed = norm(s.description) !== norm(l.description || "");
      out.push({
        key,
        name: s.name,
        status: changed ? "changed" : "matched",
        sheetDescription: s.description,
        liveId: l.id,
        liveDescription: l.description,
      });
    } else if (s) {
      out.push({
        key,
        name: s.name,
        status: "missing_in_scrunch",
        sheetDescription: s.description,
      });
    } else if (l) {
      out.push({
        key,
        name: l.name,
        status: "only_in_scrunch",
        liveId: l.id,
        liveDescription: l.description,
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function diffCompetitors(
  sheet: ScrunchCompetitor[],
  live: ScrunchLiveSnapshot["competitors"],
): ScrunchCompetitorDiffItem[] {
  const liveBy = new Map(live.map((c) => [norm(c.name), c]));
  const sheetBy = new Map(sheet.map((c) => [norm(c.name), c]));
  const keys = new Set([...sheetBy.keys(), ...liveBy.keys()]);
  const out: ScrunchCompetitorDiffItem[] = [];
  for (const key of keys) {
    const s = sheetBy.get(key);
    const l = liveBy.get(key);
    if (s && l) {
      out.push({
        key,
        name: s.name,
        status: "matched",
        sheetWebsite: s.website,
        sheetAltNames: s.altNames,
        liveId: l.id,
        liveWebsites: l.websites,
        liveAltNames: l.alternative_names,
      });
    } else if (s) {
      out.push({
        key,
        name: s.name,
        status: "missing_in_scrunch",
        sheetWebsite: s.website,
        sheetAltNames: s.altNames,
      });
    } else if (l) {
      out.push({
        key,
        name: l.name,
        status: "only_in_scrunch",
        liveId: l.id,
        liveWebsites: l.websites,
        liveAltNames: l.alternative_names,
      });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function diffTopics(sheet: ScrunchTopic[], liveTopics: string[]): ScrunchTopicDiffItem[] {
  const liveBy = new Map(liveTopics.map((t) => [norm(t), t]));
  const sheetBy = new Map(sheet.map((t) => [norm(t.name), t]));
  const keys = new Set([...sheetBy.keys(), ...liveBy.keys()]);
  const out: ScrunchTopicDiffItem[] = [];
  for (const key of keys) {
    const s = sheetBy.get(key);
    const l = liveBy.get(key);
    if (s && l) {
      out.push({ key, name: s.name, status: "matched", sheetDescription: s.description });
    } else if (s) {
      out.push({
        key,
        name: s.name,
        status: "missing_in_scrunch",
        sheetDescription: s.description,
      });
    } else if (l) {
      out.push({ key, name: l, status: "only_in_scrunch" });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function buildScrunchConnectDiff(
  sheet: Pick<ScrunchBrandSetupDoc, "description" | "personas" | "competitors" | "topics">,
  live: ScrunchLiveSnapshot,
): ScrunchConnectDiff {
  if (!live.configured) return emptyDiff(live.message, false);
  if (!live.brand) return emptyDiff(live.message, true);

  const personas = diffPersonas(sheet.personas, live.personas);
  const competitors = diffCompetitors(sheet.competitors, live.competitors);
  const topics = diffTopics(sheet.topics, live.topics);
  const description = descriptionDiff(sheet.description || "", live.brand.description || "");

  return {
    configured: true,
    message: live.message,
    brandId: live.brand.id,
    brandName: live.brand.name,
    website: live.brand.website,
    description,
    personas,
    competitors,
    topics,
    counts: {
      personasMissing: personas.filter((p) => p.status === "missing_in_scrunch").length,
      personasOnlyLive: personas.filter((p) => p.status === "only_in_scrunch").length,
      personasChanged: personas.filter((p) => p.status === "changed").length,
      competitorsMissing: competitors.filter((c) => c.status === "missing_in_scrunch").length,
      competitorsOnlyLive: competitors.filter((c) => c.status === "only_in_scrunch").length,
      topicsMissing: topics.filter((t) => t.status === "missing_in_scrunch").length,
      topicsOnlyLive: topics.filter((t) => t.status === "only_in_scrunch").length,
    },
  };
}
