import { ProfileSchema, type Profile } from "@/lib/content/profile-schema";

/**
 * SINGLE SOURCE OF TRUTH for every fact about Vishal.
 * Components, the AI assistant, the résumé PDF and JSON-LD all read from here.
 * Never invent facts. Unknown values are `null` + a TODO(vishal) comment; the UI hides them.
 */
const data = {
  name: "Vishal B G",
  headline: "Full-stack developer turning ideas into products people actually use",
  shortRole: "Full Stack Developer",
  location: "Bengaluru, India",
  timezone: "Asia/Kolkata",
  status: "Available for SDE / Full Stack roles",
  // Your own summary, taken from your current résumé (Vishal_BG_Resume.pdf). "4-time podium finisher"
  // must stay in step with the four entries in `recognition` (a unit test checks this).
  summary:
    "MCA student and Full-Stack Application Developer skilled in Java, JavaScript/TypeScript, HTML & CSS and SQL, with production experience building Spring Boot REST APIs, React/Next.js web apps and Generative AI integrations. Shipped Talnio (live on Google Play) and Golden Verdict (live SaaS); 4-time hackathon podium finisher.",
  targetRole: {
    title: "Full Stack / Application Development",
    coreSkills: [
      "Java",
      "JavaScript",
      "HTML & CSS",
      "SQL",
      "REST / API & function integration",
      "RAG fundamentals",
    ],
  },
  contact: {
    phone: "+91 96639 72259",
    phoneHref: "tel:+919663972259",
    whatsapp: "https://wa.me/919663972259",
    email: "vishalbg02@gmail.com",
    collegeEmail: "vishal.bg@mca.christuniversity.in",
    linkedin: "https://linkedin.com/in/vishalbg",
    github: "https://github.com/vishalbg02",
    calLink: null, // TODO(vishal): Cal.com 15-min link — "Book a call" stays hidden until set
  },

  education: [
    {
      degree: "Master of Computer Applications (MCA)",
      school: "CHRIST (Deemed to be University), Bengaluru",
      period: "2026 – 2028 (expected)",
      note: "Pursuing",
    },
    {
      degree: "Bachelor of Computer Applications (BCA)",
      school: "CHRIST (Deemed to be University), Bengaluru",
      period: "2023 – 2026",
      note: "CGPA 8.45 / 10",
    },
  ],

  experience: [
    {
      role: "Full-Stack & App Developer Intern",
      company: "Social Agent (Bricstal Pvt. Ltd.), Bengaluru",
      period: "Jun 2025 – Mar 2026",
      current: false,
      points: [
        "Built and shipped Talnio, an employee management platform on web (React 19, Tailwind CSS) and mobile (Flutter/Dart) with Firebase Authentication and Cloud Firestore real-time sync — live on Google Play.",
        "Implemented geolocation- and NFC-based attendance with automated PDF/Excel reports powering workforce analytics.",
        "Integrated Google Generative AI APIs to automate productivity workflows, and the Agora SDK for live video/audio meetings.",
      ],
    },
    {
      role: "Backend Developer Intern",
      company: "Kaha Technologies Pvt. Ltd. (Cove IoT), Bengaluru",
      period: "May 2024 – Jul 2024",
      current: false,
      points: [
        "Optimised Java Spring Boot backend services for boAt's IoT devices, handling real-time data across concurrent connections.",
        "Designed secure REST APIs in Java with Spring Data JPA (SQL) and Spring Security on a Spring Cloud microservices architecture.",
        "Enhanced device-management dashboards using AngularJS and TypeScript.",
      ],
    },
  ],

  projects: [
    {
      slug: "golden-verdict",
      name: "Golden Verdict",
      tagline: "Legal & tax compliance SaaS",
      type: "Freelance · Production",
      period: "Jan 2026 – Present",
      badge: null,
      live: "https://goldenverdict.com",
      repo: null,
      store: null,
      stack: ["Next.js", "TypeScript", "Firebase", "Firestore", "Tailwind CSS", "Brevo API"],
      summary:
        "Production SaaS serving Customers, Legal Partners, Managers and Administrators with role-based access control.",
      highlights: [
        "End-to-end service workflows — service purchase, document upload, application tracking via unique request IDs, automated status updates — backed by Firestore transactional operations and a scalable schema.",
        "Admin dashboards managing 50+ services, users, pricing and workflow assignments.",
        "Brevo APIs for automated invoice generation and email; CSRF protection, secure session handling, SEO-optimised public service pages.",
      ],
    },
    {
      slug: "talnio",
      name: "Talnio",
      tagline: "Employee management platform (web + mobile)",
      type: "Internship · Social Agent · Live on Google Play",
      period: "Jun 2025 – Mar 2026", // the internship it was built in
      badge: "Live on Google Play",
      live: null,
      repo: null,
      store: "https://play.google.com/store/apps/details?id=com.talnio.talnio&hl=en_IN",
      stack: [
        "React 19",
        "Tailwind CSS",
        "Flutter",
        "Dart",
        "Firebase Auth",
        "Cloud Firestore",
        "Agora SDK",
        "Google Generative AI",
      ],
      summary:
        "Dual-platform workforce platform with real-time sync, attendance, analytics, meetings and AI automation.",
      highlights: [
        "Geolocation- and NFC-based attendance; automated PDF/Excel analytics reports.",
        "Live video/audio meetings via Agora SDK.",
        "Google Generative AI to automate productivity workflows.",
      ],
    },
    {
      slug: "lansymphony",
      name: "LanSymphony",
      tagline: "Offline, encrypted peer-to-peer communication over LAN",
      type: "Personal · Built live at Windsurf × The AI Collective OpenBuild (2nd place)",
      period: "Aug 2025",
      badge: "2nd place · OpenBuild",
      live: null,
      repo: null, // TODO(vishal): repository URL
      store: null,
      stack: ["Python", "Sockets", "AES-256", "Multi-threading"],
      summary: "Serverless, internet-free communication system for local networks.",
      highlights: [
        "AES-256 encryption, automatic peer discovery, multi-threaded architecture.",
        "HD video calling, VoIP audio, screen sharing with customisable quality and Picture-in-Picture.",
      ],
    },
    {
      slug: "virtual-tour",
      name: "CHRIST University Virtual Tour",
      tagline: "Immersive 360° web experience",
      type: "Personal",
      period: "Jan 2025",
      badge: null,
      live: "https://virtual-tour-opal.vercel.app",
      repo: "https://github.com/vishalbg02/virtual_tour",
      store: null,
      stack: ["React", "Three.js", "TypeScript", "Vercel"],
      summary: "360-degree campus tour with interactive hotspots and multimedia.",
      highlights: [
        "Interactive hotspots, multimedia integration, smooth navigation controls.",
        "Optimised for web and mobile with responsive design.",
      ],
    },
  ],

  recognition: [
    {
      place: "1st Place",
      event: "Gamecraft",
      org: "Dept. of CS, CHRIST University",
      date: "Aug 2024",
      detail: "Team Lead; game: CosmoStrike",
    },
    {
      place: "2nd Place",
      event: "24-Hour Hackathon 2026",
      org: "CPCG, CHRIST University",
      date: "Feb 2026",
      detail: "solo, with Pod.ai; built SurakshaAI, a fraud-detection platform",
    },
    {
      place: "2nd Place",
      event: "Windsurf × The AI Collective OpenBuild",
      org: "Bengaluru",
      date: "Aug 2025",
      detail: "LanSymphony, 20+ teams",
    },
    {
      place: "1st Runner-Up",
      event: "Innovation Sprint 2026",
      org: "Dept. of CS (PG), CHRIST University × NEOSTATS",
      date: "Jun 2026",
      detail: null,
    },
  ],
  leadership: [
    "Core Committee, Technical Team (App Development) — GATEWAYS 2026, CHRIST University: built the official fest app in React Native.",
  ],

  skills: {
    backend: [
      "Java",
      "Spring Boot",
      "Spring Security",
      "Spring Data JPA",
      "Node.js",
      "REST APIs",
      "Microservices",
      "SQL/MySQL",
    ],
    frontend: [
      "JavaScript",
      "TypeScript",
      "React",
      "Next.js",
      "HTML5",
      "CSS3",
      "Tailwind CSS",
      "Three.js",
      "Angular",
    ],
    mobile: ["Flutter", "Dart", "React Native", "Kotlin", "Android"],
    dataCloud: ["Firebase", "Firestore", "MySQL", "MongoDB", "AWS"],
    ai: ["Generative AI APIs", "RAG fundamentals", "Function calling / API integration"],
    tools: ["Git", "GitHub", "Maven", "Postman", "IntelliJ IDEA", "VS Code", "Vercel"],
  },
  certifications: [
    "AWS Academy Cloud Foundations — Amazon Web Services (2025)",
    "Android App Development with Kotlin — Infosys Springboard (2024)",
    "Introduction to Artificial Intelligence — Infosys Springboard (2024)",
    "Modern Artificial Intelligence Masterclass — Udemy (2026)",
    "Intro to Big Data, Data Science and Artificial Intelligence — Udemy (2026)",
  ],
  languages: ["English", "Kannada", "Telugu"],
  motto: "Ship it. Measure it. Improve it.",
  workPreferences: {
    locations: "Bengaluru preferred; open to relocation",
    modes: ["On-site", "Hybrid", "Remote"],
    startDate: "No notice period; can start within a week",
    roles: [
      "Software Development Engineer (SDE)",
      "Full-Stack Developer",
      "Backend Developer (Java / Spring Boot)",
      "Generative AI application developer",
    ],
  },
  strongestAt: "Full-stack development, and Java with Spring Boot in particular",
  outsideWork: "When he has free time he builds side projects; right now he is focused on his MCA.",
} satisfies Profile;

export const profile: Profile = ProfileSchema.parse(data);

export const projectBySlug = (slug: string) => profile.projects.find((p) => p.slug === slug);
