/** "Internship · Social Agent · Live on Google Play" → "Internship · Social Agent": as many leading parts as fit one line. */
export function kindOf(type: string, max = 34): string {
  const parts = type.split(" · ");
  let out = parts[0]!;
  for (const part of parts.slice(1)) {
    if (`${out} · ${part}`.length > max) break;
    out += ` · ${part}`;
  }
  return out.length > max ? parts[0]!.slice(0, max) : out;
}
