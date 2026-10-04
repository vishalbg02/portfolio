import qrcode from "qrcode-generator";

/**
 * A QR code as a boolean matrix (true = dark), generated here with no network and no image: the Contact section
 * draws it as one SVG path at build time. Error correction M (about 15 % of the code can be damaged and it still reads).
 */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, "M"); // type 0: the smallest version that fits
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** One SVG path for the dark modules, merging runs along a row so the markup stays small. */
export function qrPath(matrix: boolean[][], quiet = 4): string {
  const out: string[] = [];
  matrix.forEach((row, r) => {
    let c = 0;
    while (c < row.length) {
      if (!row[c]) {
        c++;
        continue;
      }
      let end = c;
      while (end < row.length && row[end]) end++;
      out.push(`M${c + quiet} ${r + quiet}h${end - c}v1h-${end - c}z`);
      c = end;
    }
  });
  return out.join("");
}

/** Side length of the drawing in modules, quiet zone included. */
export const qrSize = (matrix: boolean[][], quiet = 4) => matrix.length + quiet * 2;
