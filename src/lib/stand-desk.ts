/** Hidden stand-desk URL — not linked from the public nav. */
export const STAND_DESK_PATH = "/stand-desk";

export const STAND_DESK_COOKIE = "tfm_stand_desk";

export const STAND_DESK_ROLES = ["ae", "super"] as const;

export type StandDeskRole = (typeof STAND_DESK_ROLES)[number];

export function isStandDeskRole(value: string | undefined | null): value is StandDeskRole {
  return STAND_DESK_ROLES.includes((value ?? "") as StandDeskRole);
}
