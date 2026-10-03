/**
 * Tokenizer + tiny stemmer shared by indexing and querying (so they always agree).
 * Tech terms keep their identity: "Node.js" → "nodejs", "C++" → "cpp", "CI/CD" → "cicd".
 */
const STOP = new Set(
  "a an and are as at be but by can could do does for from has have he her him his how i in is it its me my of on or our she so than that the their them there these they this to was we were what when where which who why will with would you your tell about please give show also any".split(
    " ",
  ),
);

const JOINS: Array<[RegExp, string]> = [
  [/\bnode\.js\b/g, "nodejs"],
  [/\bnext\.js\b/g, "nextjs"],
  [/\breact\.js\b/g, "react"],
  [/\bthree\.js\b/g, "threejs"],
  [/\bc\+\+/g, "cpp"],
  [/\bc#/g, "csharp"],
  [/\bci\/cd\b/g, "cicd"],
  [/\bfull[- ]stack\b/g, "fullstack"],
  [/\breal[- ]time\b/g, "realtime"],
  [/\bopen[- ]source\b/g, "opensource"],
  [/\bpeer[- ]to[- ]peer\b/g, "p2p"],
  [/\baes-?256\b/g, "aes256"],
];

export function stem(token: string): string {
  // length > 6 keeps "spring" and "string" whole while "building" → "build"
  if (token.length > 6 && token.endsWith("ing")) return token.slice(0, -3);
  if (token.length > 4 && token.endsWith("ies")) return token.slice(0, -3) + "y";
  if (token.length > 4 && token.endsWith("ed")) return token.slice(0, -2);
  // keep "nodejs", "nextjs", "threejs" intact
  if (token.length > 3 && token.endsWith("s") && !/(ss|us|js)$/.test(token)) return token.slice(0, -1);
  return token;
}

export function tokenize(text: string): string[] {
  let t = text.toLowerCase();
  for (const [re, to] of JOINS) t = t.replace(re, to);
  return t
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP.has(w))
    .map(stem);
}

/** Domain synonyms so "email him" finds the contact chunk and "is he a fit" finds role/skills. */
const EXPAND: Record<string, string[]> = {
  email: ["contact", "mail"],
  mail: ["contact", "email"],
  phone: ["contact", "number"],
  number: ["contact", "phone"],
  call: ["contact", "phone"],
  whatsapp: ["contact"],
  reach: ["contact"],
  hire: ["contact", "available", "role", "status"],
  hiring: ["contact", "available", "role", "status"],
  available: ["status", "role"],
  availability: ["status", "role"],
  fit: ["role", "skill", "experience", "fullstack"],
  suitable: ["role", "skill", "experience"],
  strength: ["skill", "experience"],
  tech: ["skill", "stack"],
  technology: ["skill", "stack"],
  technologies: ["skill", "stack"],
  stack: ["skill"],
  backend: ["java", "spring", "api"],
  frontend: ["react", "nextjs", "javascript"],
  mobile: ["flutter", "dart", "android"],
  ai: ["generative", "rag", "gemini"],
  llm: ["generative", "rag"],
  intern: ["internship", "experience"],
  internship: ["experience", "intern"],
  work: ["experience", "project", "status", "company"],
  built: ["project", "shipped"],
  build: ["project", "shipped"],
  made: ["project", "shipped"],
  college: ["education", "christ", "university"],
  degree: ["education", "mca", "bca"],
  study: ["education"],
  studied: ["education"],
  award: ["recognition", "hackathon"],
  win: ["recognition", "hackathon"],
  won: ["recognition", "hackathon"],
  hackathon: ["recognition"],
  live: ["production", "deployed"],
  location: ["bengaluru", "india"],
  city: ["bengaluru"],
  based: ["bengaluru", "location"],
  resume: ["resume"],
  cv: ["resume"],
  // "Where is he working now?" — current status, employer and availability
  currently: ["status", "experience", "role"],
  current: ["status", "experience", "role"],
  presently: ["status", "experience"],
  today: ["status"],
  now: ["status", "experience"],
  employ: ["status", "experience"],
  employer: ["experience", "company", "status"],
  employment: ["experience", "status"],
  company: ["experience", "employer"],
  organization: ["experience", "employer"],
  workplace: ["experience", "status"],
  job: ["experience", "role", "status"],
  latest: ["experience", "status"],
  recent: ["experience", "status"],
  open: ["status", "role"],
  look: ["status", "role"],
  opportunity: ["status", "role"],
  speak: ["language"],
  language: ["english", "kannada", "telugu"],
  cgpa: ["education", "bca"],
  gpa: ["education", "bca"],
  grade: ["education", "cgpa"],
  graduate: ["education", "bca", "mca"],
  university: ["education", "christ"],
  website: ["site", "nextjs", "built"],
  portfolio: ["site", "nextjs", "built"],
  site: ["site", "nextjs", "built"],
  certificate: ["certification"],
  course: ["certification"],
  github: ["contact"],
  linkedin: ["contact"],
};

/** Synonym stems for one (already stemmed) query token. */
export function synonymsOf(token: string): string[] {
  return (EXPAND[token] ?? []).map(stem);
}

export function expandQuery(tokens: string[]): string[] {
  const out = new Set(tokens);
  for (const t of tokens) for (const e of EXPAND[t] ?? []) out.add(stem(e));
  return [...out];
}
