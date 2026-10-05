# GRID: how the agent works

GRID is the AI on the site. This page is for whoever changes it (that may be you in six months). Everything here is
checked by tests; the file names point to the code.

## The shape of one question

```
visitor → Omnibar / chat → POST /api/chat
            1. router (lib/ai/agent/router.ts): obvious requests, answered from content, NO model
            2. coverage check: unrelated topic → canned refusal, NO model
            3. no key / budget spent → offline answer from the top passages, NO model
            4. otherwise a model plans (lib/ai/chat.ts), with the tools below, ≤ 5 steps, 25 s
               routes in order: Gemini → Groq gpt-oss-120b → Groq gpt-oss-20b → offline
        ← NDJSON events: meta, sources, tool, part (a card), text, followups, done
```

The model never writes a card. A tool returns `{ part, summary }`: `part` is a card the **server** builds from
`content/*.ts` (so it cannot state anything the content doesn't), and `summary` is the short text the model sees.

## Tools (`lib/ai/agent/tools.ts`, names in `lib/ai/protocol.ts`)

| Tool                     | Card      | What it does                                                                                                            |
| ------------------------ | --------- | ----------------------------------------------------------------------------------------------------------------------- |
| `search_profile`         | none      | hybrid retrieval; the only source of facts for the model                                                                |
| `show_project`           | project   | the project, with the real capture                                                                                      |
| `show_diagram`           | diagram   | the architecture diagram, interactive                                                                                   |
| `show_role`              | role      | one of his roles (internship / freelance): title, dates, first line, stack                                              |
| `play_demo`              | demo      | moves the Work showcase to the project (or opens its case study)                                                        |
| `show_skill_evidence`    | skill     | where a skill is shown: projects, roles, leadership, this site, or CHRIST                                               |
| `match_job`              | match     | deterministic strong / partial / gap against a pasted job description                                                   |
| `navigate`               | navigate  | scrolls to / opens a page of THIS site (a fixed list of targets)                                                        |
| `get_contact`            | contact   | email, phone, WhatsApp, LinkedIn, GitHub as copy / call / open buttons                                                  |
| `get_site_stats`         | stats     | real Lighthouse scores, last deploy, live status                                                                        |
| `draft_message`          | draft     | a template for the VISITOR to edit: interview invite, intro, inquiry, team                                              |
| `send_message_to_vishal` | confirm   | **prepares** a message, pre-filled from what the visitor said (name, email, company, role; `slots.ts`); nothing is sent |
| `book_call`              | book      | the Cal.com button when `calLink` is set, else an offer to leave a message                                              |
| `tailor_resume`          | resume    | re-orders his résumé for a role (see below) with a PDF download                                                         |
| `interview_answer`       | interview | his own written answer from `content/interview.ts`, or "not written yet"                                                |
| `start_live_chat`        | live      | whether he is online, and a button that opens the live chat from a summary                                              |

To add a tool: add its name to `TOOL_NAMES`, a card kind to `UiPart` / `PART_KINDS`, build the card in `cards.ts` (or its
own module), register it in `buildTools`, draw it in `components/grid/cards/PartView.tsx`, describe it in
`lib/grid/export.ts`, and add tests. `tests/unit/agent.test.ts` fails until every one of those exists.

## The gate: GRID can prepare a message, never send one

`send_message_to_vishal` has no way to deliver: `lib/ai/agent/tools.ts` imports nothing that sends (a test reads its
imports). It returns a **confirm card**: name, email and message, all editable, with Send, Edit and Cancel. Only when the
visitor presses Send does the browser POST to `/api/grid/message`, which:

1. checks the origin, the body size and the fields (Zod, the same limits as the card: name 2–80, message 10–1,500,
   at most 2 links, valid email), and a honeypot,
2. limits each client to 3 messages / 10 min and 8 / day, and everyone together to 60 / day,
3. delivers once per `requestId` (a double click or a retry cannot send twice),
4. sends to every configured channel: Telegram (`TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`, HTML-escaped) and email
   (Resend, reply-to is the visitor), and counts it delivered if at least one took it.

With neither channel configured the card says so and offers `mailto:`. Only counts are logged, never message text or the
token. What happened to a card (sent / cancelled) is remembered in the browser so it is not offered twice.

## Tailored résumé (`lib/resume/tailor.ts`, `/api/resume/tailor`)

The requirements come from a job description (the matcher extracts them, with the model only if it is online) or a
short focus. A deterministic selector then **re-orders** what the résumé already says: bullets within a role, projects,
skill groups, matching skills first. It writes nothing, drops nothing, and keeps the standard résumé's one page. Gaps are
listed, never hidden. The PDF route takes only the requirements, so it calls no model.

## Interview notes (`content/interview.ts`)

Twelve questions; `answer: null` until Vishal writes his own. GRID shows an answer verbatim ("In his own words") or says
he hasn't written one and offers to send him the question. **Interview mode** appears once at least 3 are answered.

## Languages and voice

A visitor can choose Auto, English, Kannada or Hindi (`lib/ai/lang.ts`): one sentence is added to the prompt, and facts,
project names and numbers stay identical. Dictation and spoken replies use the browser's own Web Speech API
(`components/grid/voice/`): feature-detected (absent where unsupported), nothing starts by itself, spoken replies are off
until the visitor turns the speaker on (and are never remembered), and the text is always on screen.

## Safety and cost

Third person, never claims to be Vishal; user text and pasted text are data; tool arguments are Zod-validated (a slug is
one of four, a navigation target one of a fixed list); links and HTML are stripped from model text; per-client rate
limits, a daily budget (`AI_DAILY_LIMIT`), input caps and output caps. Model IDs live only in `lib/ai/models.ts`.

## Environment

| Variable                                 | Used for                                              |
| ---------------------------------------- | ----------------------------------------------------- |
| `GEMINI_API_KEY`, `GROQ_API_KEY`         | the model routes (either alone is enough)             |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN`      | shared rate limits, the daily budget, once-only sends |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | messages to Vishal's phone                            |
| `RESEND_API_KEY`, `CONTACT_TO_EMAIL`     | messages to his inbox (and the contact form)          |

Everything is optional: with none of them the site builds and runs, and GRID answers offline.

## The Ask section's intro

The home page's Ask section (`components/sections/AskVishal.tsx`) opens with a pitch, four promises (each is something
the code does), and eight capability cards, each a link that opens GRID with its question. Beside them the chat loads
lazily (`LazyGridChat`) and its empty state plays a **demo**:

- `DemoReel` loops four exchanges: _Show me Talnio_, _Where did he use Spring Boot?_, _Take me to contact_, _Can I book a
  call with him?_ Each is the **deterministic router's real answer** (`lib/ai/agent/demo.ts` calls `routeIntent`; nothing
  is scripted by hand), so the demo can only show cards GRID really draws. The questions need no model and no network at
  build time; the unit test fails if the router stops answering one, and keeps live presence and site stats out of it.
- The timeline is a pure function (`frameAt` in `lib/grid/demo.ts`): type the question, send, think, the tool's working
  line, the card, the answer typed with its citations, hold. The face follows the phase.
- It is decorative to assistive tech: the stage is `aria-hidden` and `inert`, and a visually hidden caption carries the
  same example as text. There is a Pause/Play button (WCAG 2.2.2), dots to choose an example, and "Ask this myself",
  which sends that question to the real chat. It pauses by itself when scrolled away or in a background tab, and under
  `prefers-reduced-motion` nothing plays: the first example is already finished and the dots step through them.
- Heights: the stage is a fixed height and the placeholder (`LazyGridChat`) is as tall as the opened chat, so the section
  does not change height when the chat loads (e2e checks 390, 768 and 1440 px). If the demo's content or the chat's
  controls change height, re-measure and update the placeholder's `h-[…]` classes.
