import "server-only";
import type { ScrunchConnectDiff, ScrunchSyncAction } from "@/lib/scrunch-diff-types";
import type { ScrunchBrandSetupDoc } from "@/lib/scrunch-setup-types";
import { buildScrunchConnectDiff } from "@/server/scrunch/compare";
import {
  archiveScrunchCompetitor,
  archiveScrunchPersona,
  competitorPayloadFromSheet,
  createScrunchCompetitorWithFallback,
  createScrunchPersona,
  lookupScrunchLive,
  patchScrunchBrand,
  pushBrandTopics,
  sanitizeTopicName,
  updateScrunchPersona,
} from "@/server/scrunch/rest-client";
import { saveLeadScrunchSetup } from "@/server/audit/lead-log";

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function liveCompetitorWebsites(
  live: { brand?: { website?: string } | null; competitors: { websites?: string[] }[] },
): string[] {
  return [
    live.brand?.website || "",
    ...live.competitors.flatMap((c) => c.websites || []),
  ].filter(Boolean);
}

function recount(doc: ScrunchBrandSetupDoc): ScrunchBrandSetupDoc {
  return {
    ...doc,
    counts: {
      ...doc.counts,
      topics: doc.topics.length,
      competitors: doc.competitors.length,
      personas: doc.personas.length,
    },
  };
}

export async function connectScrunchDiff(doc: ScrunchBrandSetupDoc): Promise<ScrunchConnectDiff> {
  const live = await lookupScrunchLive({
    brandName: doc.brandName,
    website: doc.website,
    scrunchBrandId: doc.scrunchBrandId,
    scrunchOrgId: doc.scrunchOrgId,
  });
  return buildScrunchConnectDiff(doc, live);
}

export async function applyScrunchSync(opts: {
  leadId: string;
  doc: ScrunchBrandSetupDoc;
  action: ScrunchSyncAction;
}): Promise<{
  doc: ScrunchBrandSetupDoc;
  diff: ScrunchConnectDiff;
  notice: string;
  warnings: string[];
}> {
  let doc = { ...opts.doc };
  const brandIdRaw = doc.scrunchBrandId?.trim();
  if (!brandIdRaw) throw new Error("Save a Scrunch brand id before syncing.");
  const brandId = Number(brandIdRaw);
  if (!Number.isFinite(brandId)) throw new Error("Scrunch brand id must be a number.");
  const warnings: string[] = [];

  const live = await lookupScrunchLive({
    brandName: doc.brandName,
    website: doc.website,
    scrunchBrandId: String(brandId),
    scrunchOrgId: doc.scrunchOrgId,
  });
  if (!live.configured || !live.brand) {
    throw new Error(live.message || "Could not connect to Scrunch.");
  }

  const action = opts.action;
  let notice = "Synced.";

  switch (action.type) {
    case "push_description": {
      await patchScrunchBrand(brandId, { description: doc.description || "" });
      notice = "Brand description updated in Scrunch.";
      break;
    }
    case "pull_description": {
      doc = recount({ ...doc, description: live.brand.description || "" });
      notice = "Brand description pulled into this sheet.";
      break;
    }
    case "push_persona": {
      const persona = doc.personas.find((p) => norm(p.name) === norm(action.name));
      if (!persona) throw new Error(`Persona “${action.name}” not found on the sheet.`);
      await createScrunchPersona(brandId, {
        name: persona.name,
        description: persona.description || persona.name,
      });
      notice = `Persona “${persona.name}” created in Scrunch.`;
      break;
    }
    case "update_persona": {
      const persona = doc.personas.find((p) => norm(p.name) === norm(action.name));
      if (!persona) throw new Error(`Persona “${action.name}” not found on the sheet.`);
      await updateScrunchPersona(brandId, action.liveId, {
        name: persona.name,
        description: persona.description || persona.name,
      });
      notice = `Persona “${persona.name}” updated in Scrunch.`;
      break;
    }
    case "archive_persona": {
      await archiveScrunchPersona(brandId, action.liveId);
      notice = "Persona archived in Scrunch.";
      break;
    }
    case "pull_persona": {
      const livePersona = live.personas.find((p) => p.id === action.liveId);
      if (!livePersona) throw new Error("Live persona not found.");
      const existingIdx = doc.personas.findIndex((p) => norm(p.name) === norm(livePersona.name));
      if (existingIdx >= 0) {
        const personas = [...doc.personas];
        personas[existingIdx] = {
          name: livePersona.name,
          description: livePersona.description || "",
        };
        doc = recount({ ...doc, personas });
        notice = `Persona “${livePersona.name}” updated on this sheet.`;
      } else {
        doc = recount({
          ...doc,
          personas: [
            ...doc.personas,
            { name: livePersona.name, description: livePersona.description || "" },
          ],
        });
        notice = `Persona “${livePersona.name}” added to this sheet.`;
      }
      break;
    }
    case "remove_persona_local": {
      doc = recount({
        ...doc,
        personas: doc.personas.filter((p) => norm(p.name) !== norm(action.name)),
      });
      notice = `Persona “${action.name}” removed from this sheet.`;
      break;
    }
    case "push_competitor": {
      const competitor = doc.competitors.find((c) => norm(c.name) === norm(action.name));
      if (!competitor) throw new Error(`Competitor “${action.name}” not found on the sheet.`);
      await createScrunchCompetitorWithFallback(
        brandId,
        competitorPayloadFromSheet(competitor, {
          brandWebsite: live.brand.website,
          liveWebsites: liveCompetitorWebsites(live),
        }),
      );
      notice = `Competitor “${competitor.name}” created in Scrunch.`;
      break;
    }
    case "archive_competitor": {
      await archiveScrunchCompetitor(brandId, action.liveId);
      notice = "Competitor archived in Scrunch.";
      break;
    }
    case "pull_competitor": {
      const liveComp = live.competitors.find((c) => c.id === action.liveId);
      if (!liveComp) throw new Error("Live competitor not found.");
      if (!doc.competitors.some((c) => norm(c.name) === norm(liveComp.name))) {
        doc = recount({
          ...doc,
          competitors: [
            ...doc.competitors,
            {
              name: liveComp.name,
              altNames: (liveComp.alternative_names || []).join(", "),
              website: (liveComp.websites || [])[0] || "",
              whyInScope: "Pulled from Scrunch",
            },
          ],
        });
      }
      notice = `Competitor “${liveComp.name}” added to this sheet.`;
      break;
    }
    case "remove_competitor_local": {
      doc = recount({
        ...doc,
        competitors: doc.competitors.filter((c) => norm(c.name) !== norm(action.name)),
      });
      notice = `Competitor “${action.name}” removed from this sheet.`;
      break;
    }
    case "push_topic": {
      const topic = doc.topics.find((t) => norm(t.name) === norm(action.name));
      if (!topic) throw new Error(`Topic “${action.name}” not found on the sheet.`);
      const result = await pushBrandTopics({
        brandId,
        current: live.topics || [],
        add: [sanitizeTopicName(topic.name)],
      });
      if (result.failed.length) {
        throw new Error(result.failed.map((f) => `${f.name}: ${f.error}`).join(" · "));
      }
      notice = `Topic “${topic.name}” added in Scrunch.`;
      break;
    }
    case "remove_topic_scrunch": {
      const nextTopics = (live.topics || []).filter((t) => norm(t) !== norm(action.name));
      await patchScrunchBrand(brandId, { key_topics: nextTopics });
      notice = `Topic “${action.name}” removed from Scrunch.`;
      break;
    }
    case "pull_topic": {
      if (!doc.topics.some((t) => norm(t.name) === norm(action.name))) {
        doc = recount({
          ...doc,
          topics: [...doc.topics, { name: action.name, description: "" }],
        });
      }
      notice = `Topic “${action.name}” added to this sheet.`;
      break;
    }
    case "remove_topic_local": {
      doc = recount({
        ...doc,
        topics: doc.topics.filter((t) => norm(t.name) !== norm(action.name)),
      });
      notice = `Topic “${action.name}” removed from this sheet.`;
      break;
    }
    case "push_all_missing": {
      if (action.section === "personas") {
        const missing = doc.personas.filter(
          (p) => !live.personas.some((l) => norm(l.name) === norm(p.name)),
        );
        let ok = 0;
        for (const persona of missing) {
          try {
            await createScrunchPersona(brandId, {
              name: persona.name,
              description: persona.description || persona.name,
            });
            ok += 1;
          } catch (err: unknown) {
            warnings.push(`${persona.name}: ${errorText(err)}`);
          }
        }
        notice = `Synced ${ok} of ${missing.length} missing persona(s) to Scrunch.`;
        if (!ok && missing.length) throw new Error(warnings.join(" · ") || "No personas synced.");
      } else if (action.section === "competitors") {
        const missing = doc.competitors.filter(
          (c) => !live.competitors.some((l) => norm(l.name) === norm(c.name)),
        );
        let ok = 0;
        const usedWebsites = liveCompetitorWebsites(live);
        for (const competitor of missing) {
          try {
            await createScrunchCompetitorWithFallback(
              brandId,
              competitorPayloadFromSheet(competitor, {
                brandWebsite: live.brand.website,
                liveWebsites: usedWebsites,
              }),
            );
            const createdSite = competitor.website?.trim();
            if (createdSite) usedWebsites.push(createdSite);
            ok += 1;
          } catch (err: unknown) {
            warnings.push(`${competitor.name}: ${errorText(err)}`);
          }
        }
        notice = `Synced ${ok} of ${missing.length} missing competitor(s) to Scrunch.`;
        if (!ok && missing.length) throw new Error(warnings.join(" · ") || "No competitors synced.");
      } else {
        const missing = doc.topics.filter(
          (t) => !live.topics.some((l) => norm(l) === norm(t.name)),
        );
        if (missing.length) {
          const result = await pushBrandTopics({
            brandId,
            current: live.topics || [],
            add: missing.map((t) => t.name),
          });
          for (const fail of result.failed) {
            warnings.push(`${fail.name}: ${fail.error}`);
          }
          const ok = missing.length - result.failed.length;
          notice = `Synced ${ok} of ${missing.length} missing topic(s) to Scrunch.`;
          if (!ok) {
            throw new Error(
              warnings.join(" · ") ||
                "Scrunch returned 500 updating topics. Add them in the Scrunch dashboard if this keeps failing.",
            );
          }
        } else {
          notice = "No missing topics to sync.";
        }
      }
      break;
    }
    default: {
      const _exhaustive: never = action;
      throw new Error(`Unknown sync action: ${JSON.stringify(_exhaustive)}`);
    }
  }

  if (opts.leadId) {
    await saveLeadScrunchSetup(opts.leadId, doc);
  }

  const refreshed = await lookupScrunchLive({
    brandName: doc.brandName,
    website: doc.website,
    scrunchBrandId: String(brandId),
    scrunchOrgId: doc.scrunchOrgId,
  });
  const diff = buildScrunchConnectDiff(doc, refreshed);
  return { doc, diff, notice, warnings };
}
