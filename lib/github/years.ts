/** Calendar years offered by the activity switcher: this year back to the earliest milestone year. */
export function activityYears(nowMs: number, earliest: number): number[] {
  const current = new Date(nowMs).getUTCFullYear();
  const out: number[] = [];
  for (let y = current; y >= Math.min(earliest, current); y--) out.push(y);
  return out;
}

/** GraphQL `from`/`to` for one calendar year; the current year ends now (GitHub rejects the future). */
export function yearRange(year: number, nowMs: number): { from: string; to: string } {
  const end = Date.parse(`${year}-12-31T23:59:59Z`);
  return { from: `${year}-01-01T00:00:00Z`, to: new Date(Math.min(end, nowMs)).toISOString() };
}
