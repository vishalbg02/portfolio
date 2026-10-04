import { z } from "zod";

/**
 * Zod compiles object schemas with `new Function` unless told not to, and probes for it while building each
 * schema. The site's CSP has no 'unsafe-eval', so in the browser (where a lazy chunk can pull the content
 * schemas in) the probe is a caught but noisy "Refused to evaluate a string as JavaScript" violation. The
 * schema modules import this first, so the setting is in place before the first schema is built. The server
 * keeps the compiled fast path.
 */
if (typeof window !== "undefined") z.config({ jitless: true });
