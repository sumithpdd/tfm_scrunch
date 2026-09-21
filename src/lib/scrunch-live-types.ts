export type ScrunchLiveBrand = {
  id: number;
  name: string;
  website: string;
  description?: string;
  key_topics?: string[];
};

export type ScrunchLivePersona = { id: number; name: string; description: string };

export type ScrunchLiveCompetitor = {
  id: number;
  name: string;
  alternative_names?: string[];
  websites?: string[];
};

export type ScrunchLivePrompt = {
  id: number;
  text: string;
  stage: string;
  topics?: string[];
};

export type ScrunchLiveSnapshot = {
  configured: boolean;
  message: string;
  brand: ScrunchLiveBrand | null;
  personas: ScrunchLivePersona[];
  competitors: ScrunchLiveCompetitor[];
  prompts: ScrunchLivePrompt[];
  promptTotal: number;
  personaTotal: number;
  competitorTotal: number;
  topics: string[];
};
