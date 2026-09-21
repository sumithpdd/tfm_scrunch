import { SITE } from "@/lib/site-config";

export type BoothAccountSeed = {
  company: string;
  website: string;
  aeName: string;
  aeEmail: string;
};

const RAJEEVAN: Pick<BoothAccountSeed, "aeName" | "aeEmail"> = {
  aeName: "Rajeevan Rai",
  aeEmail: "rai@sitecore.net",
};

const ADAM: Pick<BoothAccountSeed, "aeName" | "aeEmail"> = {
  aeName: "Adam Glapa",
  aeEmail: "glap@sitecore.net",
};

/** Known AE-owned accounts to keep on the stand desk. */
export const BOOTH_ACCOUNT_SEEDS: BoothAccountSeed[] = [
  { company: "Ferrero", website: "https://www.ferrero.com/int/en/", ...RAJEEVAN },
  { company: "Thorntons", website: "https://www.thorntons.com/uk/", ...RAJEEVAN },
  { company: "Fannie May", website: "https://www.fanniemay.com/us/", ...RAJEEVAN },
  { company: "Power Crunch", website: "https://powercrunch.com/", ...RAJEEVAN },
  { company: "Zopa", website: "https://www.zopa.com/", ...ADAM },
  { company: "OakNorth", website: "https://www.oaknorth.co.uk/", ...ADAM },
  { company: "NatWest", website: "https://www.natwest.com/", ...ADAM },
  { company: "CFA Institute", website: "https://www.cfainstitute.org/", ...ADAM },
  { company: "Dermalogica", website: "https://www.dermalogica.com/", ...ADAM },
  { company: "Terumo Aortic", website: "https://terumoaortic.com/", ...ADAM },
  { company: "Nuchem Pharmacy", website: "https://nuchempharmacy.net/", ...ADAM },
  { company: "Parkinson's UK", website: "https://www.parkinsons.org.uk/", ...ADAM },
  { company: "Carnival UK", website: "https://www.pocruises.com/", ...ADAM },
  { company: "St Austell Brewery", website: "https://www.staustellbrewery.co.uk/", ...ADAM },
  { company: "Elite Hotels", website: "https://www.elitehotels.co.uk/", ...ADAM },
];

export function boothAccountVisitorEmail(): string {
  return SITE.defaultVisitorEmail;
}
