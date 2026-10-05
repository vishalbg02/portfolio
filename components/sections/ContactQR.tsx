import { qrMatrix, qrPath, qrSize } from "@/lib/contact/qr";
import { VCARD_PATH } from "@/lib/contact/vcard";
import { site } from "@/lib/site";

/**
 * A QR code that opens Vishal's vCard on a phone (scan it from a desktop screen and the phone offers "Add contact").
 * Code-generated at build time, drawn as one SVG path: dark modules on a light tile with a quiet zone, because that is
 * what scanners read reliably. It is for screens that can't tap a link, so it is shown from the lg breakpoint only.
 */
export function ContactQR() {
  const url = `${site.url}${VCARD_PATH}`;
  const matrix = qrMatrix(url);
  const size = qrSize(matrix);
  return (
    <figure className="hidden items-center gap-4 rounded-card border border-border bg-surface p-4 lg:flex">
      <span className="brackets m-2 shrink-0">
        <svg
          role="img"
          aria-label="QR code for Vishal's contact card"
          viewBox={`0 0 ${size} ${size}`}
          shapeRendering="crispEdges"
          className="block size-28 rounded-sm"
          data-testid="contact-qr"
        >
          <rect width={size} height={size} fill="#e6edf3" />
          <path d={qrPath(matrix)} fill="#0d1117" />
        </svg>
      </span>
      <figcaption>
        <p className="text-sm font-medium text-text">Scan to save my contact</p>
        <p className="mt-1 text-sm text-muted">
          Point a phone camera at this and it offers to add Vishal B G to your contacts.
        </p>
      </figcaption>
    </figure>
  );
}
