/** True when a hidden trap field looks like Chrome/Safari copied a real form value. */
export function honeypotLooksLikeAutofill(
  trap: string,
  fields: { website?: string; brandName?: string; company?: string; name?: string; email?: string },
): boolean {
  const hp = trap.trim().toLowerCase();
  if (!hp) return true;
  const known = [fields.website, fields.brandName, fields.company, fields.name, fields.email]
    .map((v) => (v ?? "").trim().toLowerCase())
    .filter(Boolean);
  return known.some((value) => hp === value || hp.includes(value) || value.includes(hp));
}
