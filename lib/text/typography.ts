/**
 * Typographic cleanup for printed output (the résumé PDF): straight apostrophes and quotes
 * become curly ones (boAt's → boAt’s). All of these glyphs exist in WinAnsi, so the built-in
 * Helvetica can draw them.
 */
export function smart(text: string): string {
  return text
    .replace(/(\w)'(\w)/g, "$1’$2") // boAt's, don't
    .replace(/(^|[\s([{])"/g, "$1“") // opening double quote
    .replace(/"/g, "”") // closing double quote
    .replace(/(^|[\s([{])'/g, "$1‘") // opening single quote
    .replace(/'/g, "’"); // closing single quote / trailing apostrophe
}
