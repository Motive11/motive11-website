/**
 * Countries whose visitors the site never identifies or profiles: all of Europe. Read by /api/v
 * (the visitor ledger), _middleware.ts (the page count), and /api/geo where a site has one, so they
 * can never disagree. A page view from these countries is counted by /api/v with no cookie, no ID,
 * and no device details, and nothing else. Identical on every site that runs the ledger and in the
 * mjs.link Worker: change one, copy it to all.
 *
 * Why all of Europe and not just the EU, the EEA, and the UK, whose laws require a yes before
 * tracking: Mark's rule is "never Europe" (October 31, 2026, when he chose this over a consent
 * banner), and on November 5, 2026 he made it literal. Switzerland's regulator said in October
 * 2025 that profiling needs a real yes, Turkey's says the same, and the rest of non-EU Europe has
 * GDPR-style laws whose cookie rules nobody could pin down. They sent 8 tracked browsers in the
 * ledger's first five days, so skipping them costs nothing.
 *
 * Quebec too (November 20, 2026): its Law 25, section 8.1, says anything that can identify or
 * profile a visitor must be off until they switch it on. Cloudflare's regionCode names the province,
 * so the rest of Canada is unaffected. A Canadian visit with no province is treated as unknown.
 */

export const NO_TRACK = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV",
  "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE",
  "GF", "GP", "MQ", "RE", "YT", "MF", "AX",
  "IS", "LI", "NO",
  "GB", "GI", "JE", "GG", "IM",
  "CH", "TR", "AD", "MC", "SM", "VA", "AL", "BA", "ME", "MK", "RS", "XK", "MD", "UA", "BY", "RU",
  "GE", "AM", "AZ", "FO", "GL", "SJ",
]);

/** Places inside a tracked country that are skipped like Europe, as COUNTRY-REGION. */
export const NO_TRACK_REGIONS = new Set(["CA-QC"]);
const REGION_COUNTRIES = new Set([...NO_TRACK_REGIONS].map((r) => r.split("-")[0]));

/** The visitor's country code from Cloudflare, upper case, "" when Cloudflare has none. */
export function countryOf(request: Request): string {
  return ((request as any).cf?.country || request.headers.get("CF-IPCountry") || "").toUpperCase();
}

/** true may track, false must not, null unknown (store nothing new, delete nothing). */
export function mayTrack(request: Request): boolean | null {
  const country = countryOf(request);
  if (!country || country === "XX" || country === "T1") return null;
  if (NO_TRACK.has(country)) return false;
  if (!REGION_COUNTRIES.has(country)) return true;
  const region = String((request as any).cf?.regionCode || "").toUpperCase();
  if (!region) return null;
  return !NO_TRACK_REGIONS.has(`${country}-${region}`);
}
