import { profile } from "@/content/profile";
import type { Profile } from "@/lib/content/profile-schema";
import { site } from "@/lib/site";

/** Where the vCard is served (a static route), and the name a phone saves it under. */
export const VCARD_PATH = "/vishal-b-g.vcf";
export const VCARD_FILENAME = "Vishal_B_G.vcf";

/** vCard text values escape backslash, comma, semicolon and newline. */
const esc = (v: string) =>
  v.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\;");

/** Lines are folded at 75 characters (RFC 6350 §3.2): a continuation starts with one space. */
export function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts = [line.slice(0, 75)];
  for (let i = 75; i < line.length; i += 74) parts.push(` ${line.slice(i, i + 74)}`);
  return parts.join("\r\n");
}

/**
 * Vishal's contact card (vCard 3.0), built only from content/profile.ts: his name, role, phone, email, the site,
 * LinkedIn and GitHub, and the city. Nothing is added that the profile does not say.
 */
export function buildVCard(
  p: Pick<Profile, "name" | "shortRole" | "location" | "contact"> = profile,
  url: string = site.url,
): string {
  const [given = p.name, ...family] = p.name.split(/\s+/);
  const [city = "", country = ""] = p.location.split(",").map((s) => s.trim());
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${esc(p.name)}`,
    `N:${esc(family.join(" "))};${esc(given)};;;`,
    `TITLE:${esc(p.shortRole)}`,
    `TEL;TYPE=CELL:${p.contact.phoneHref.replace(/^tel:/, "")}`,
    `EMAIL;TYPE=INTERNET:${p.contact.email}`,
    `URL:${url}`,
    `URL:${p.contact.linkedin}`,
    `URL:${p.contact.github}`,
    city ? `ADR:;;;${esc(city)};;;${esc(country)}` : null,
    "END:VCARD",
  ].filter((l): l is string => l !== null);
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
