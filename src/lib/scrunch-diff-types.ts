/** Diff between local build sheet and live Scrunch brand config. */

export type ScrunchDiffStatus =
  | "matched"
  | "missing_in_scrunch"
  | "only_in_scrunch"
  | "changed";

export type ScrunchDescriptionDiff = {
  status: ScrunchDiffStatus | "empty";
  sheet: string;
  live: string;
};

export type ScrunchPersonaDiffItem = {
  key: string;
  name: string;
  status: ScrunchDiffStatus;
  sheetDescription?: string;
  liveId?: number;
  liveDescription?: string;
};

export type ScrunchCompetitorDiffItem = {
  key: string;
  name: string;
  status: ScrunchDiffStatus;
  sheetWebsite?: string;
  sheetAltNames?: string;
  liveId?: number;
  liveWebsites?: string[];
  liveAltNames?: string[];
};

export type ScrunchTopicDiffItem = {
  key: string;
  name: string;
  status: ScrunchDiffStatus;
  sheetDescription?: string;
};

export type ScrunchConnectDiff = {
  configured: boolean;
  message: string;
  brandId: number | null;
  brandName: string | null;
  website: string | null;
  description: ScrunchDescriptionDiff;
  personas: ScrunchPersonaDiffItem[];
  competitors: ScrunchCompetitorDiffItem[];
  topics: ScrunchTopicDiffItem[];
  counts: {
    personasMissing: number;
    personasOnlyLive: number;
    personasChanged: number;
    competitorsMissing: number;
    competitorsOnlyLive: number;
    topicsMissing: number;
    topicsOnlyLive: number;
  };
};

export type ScrunchSyncAction =
  | { type: "push_description" }
  | { type: "pull_description" }
  | { type: "push_persona"; name: string }
  | { type: "update_persona"; liveId: number; name: string }
  | { type: "archive_persona"; liveId: number }
  | { type: "pull_persona"; liveId: number }
  | { type: "remove_persona_local"; name: string }
  | { type: "push_competitor"; name: string }
  | { type: "archive_competitor"; liveId: number }
  | { type: "pull_competitor"; liveId: number }
  | { type: "remove_competitor_local"; name: string }
  | { type: "push_topic"; name: string }
  | { type: "remove_topic_scrunch"; name: string }
  | { type: "pull_topic"; name: string }
  | { type: "remove_topic_local"; name: string }
  | { type: "push_all_missing"; section: "personas" | "competitors" | "topics" };
