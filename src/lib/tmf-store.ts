/**
 * Firestore collection ids for the TMF booth kiosk.
 * All persisted leads, reports, and PDFs use the `tmf_` prefix.
 */
export const TMF_EVENT_CODE = "TMF";

export const LEADS_COLLECTION = "tmf_scrunch_leads";
export const REPORTS_COLLECTION = "tmf_scrunch_reports";

/** Previous names — reads still fall back here so older booth docs are not lost. */
export const LEGACY_LEADS_COLLECTION = "TFM_Scrunch_leads";
export const LEGACY_REPORTS_COLLECTION = "TFM_Scrunch_reports";
