import { ResumeConfigSchema } from "@/lib/resume/config-schema";

/**
 * ✏️  EDIT THIS FILE TO UPDATE YOUR RÉSUMÉ.   (full guide: docs/UPDATING-RESUME.md)
 *
 * Résumé-only wording lives here. Facts that also appear on the website — work experience,
 * education, certifications, contact details — come from content/profile.ts, so a new
 * internship or certificate is added there ONCE and shows up on the site AND the résumé.
 *
 * After editing:   pnpm resume        → validates, builds the PDF, tells you if it spills past one page
 *                  pnpm resume --open → …and opens it
 *                  git push           → Vercel rebuilds; /resume and /resume.pdf update automatically
 *
 * Wording below is transcribed from your current résumé (Vishal_BG_Resume.pdf).
 */
export const resumeConfig = ResumeConfigSchema.parse({
  updatedAt: "2026-10-03",

  header: {
    subtitle:
      "Master of Computer Applications (MCA) | Batch 2026–28 | CHRIST (Deemed to be University), Bengaluru",
    location: "Bengaluru, Karnataka",
    email: "college", // "college" = vishal.bg@mca.christuniversity.in · "primary" = vishalbg02@gmail.com
  },

  projects: [
    {
      slug: "golden-verdict",
      title: "Golden Verdict – Legal & Tax Compliance SaaS",
      stack: "Next.js, TypeScript, Firebase",
      date: "Freelance",
      bullets: [
        "Built and deployed a production SaaS (goldenverdict.com) with role-based access for Customers, Legal Partners, Managers and Admins.",
        "Engineered purchase, document upload and request-ID tracking workflows on Firestore; built admin dashboards for 50+ services and integrated Brevo REST APIs for automated invoicing and email.",
      ],
    },
    {
      slug: "lansymphony",
      title: "LAN Communication System – Offline P2P",
      stack: "Python, Sockets, AES-256",
      date: "Aug 2025",
      bullets: [
        "Built an AES-256 encrypted, multi-threaded P2P system with auto peer discovery, HD video calling, VoIP audio and screen sharing.",
      ],
    },
    {
      slug: "virtual-tour",
      title: "Virtual Tour – Immersive 360-Degree Web Experience",
      stack: "React.js, Three.js",
      date: "Jan 2025",
      bullets: [
        "Developed a 360-degree virtual tour with interactive hotspots and multimedia, optimised for web and mobile.",
      ],
    },
  ],

  // Talnio is described under Work Experience instead of Projects.
  omittedProjects: [{ slug: "talnio", reason: "Already covered under Work Experience" }],

  skills: [
    {
      label: "Technical",
      items: [
        "Java",
        "JavaScript",
        "TypeScript",
        "HTML5",
        "CSS3",
        "SQL",
        "Spring Boot",
        "React.js",
        "Next.js",
        "Node.js",
        "React Native",
        "Firebase",
        "Git",
      ],
    },
    { label: "Domain", items: ["API & Function Integration", "RAG Fundamentals"] },
    { label: "Soft Skills", items: ["Problem Solving"] },
    { label: "Languages", items: ["English", "Kannada", "Telugu"] },
  ],

  leadership: [
    {
      title: "GATEWAYS 2026 – CS Fest, CHRIST University, Bengaluru",
      date: "2026",
      role: "Core Committee – Technical Team (App Development)",
      bullets: [
        "Developed the official GATEWAYS 2026 fest mobile app using React Native for event schedules and updates.",
      ],
    },
  ],

  achievements: [
    {
      title: "Innovation Sprint 2026 Hackathon – 2nd Place",
      detail: "Dept. of CS (PG), CHRIST University & NEOSTATS",
      date: "Jun 2026",
    },
    {
      title: "24-Hour Hackathon 2026 – Winner",
      detail: "CPCG, CHRIST University, in association with Pod.ai",
      date: "Mar 2026",
    },
    {
      title: "Windsurf x The AI Collective OpenBuild – 2nd Place",
      detail: "Bengaluru; built LanSymphony, 20+ teams",
      date: "Aug 2025",
    },
    {
      title: "Gamecraft – 1st Place (Team Lead)",
      detail: "Dept. of CS, CHRIST University; built space game CosmoStrike",
      date: "Aug 2024",
    },
  ],
});
