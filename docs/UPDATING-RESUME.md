# Updating your résumé

Your résumé is **generated from data**, never edited as a PDF. Change the data once and three things update together:

| Output                  | Where                                            |
| ----------------------- | ------------------------------------------------ |
| The PDF people download | `/resume.pdf` (file name `Vishal_BG_Resume.pdf`) |
| The HTML résumé page    | `/resume`                                        |
| The rest of the site    | work, experience, skills, AI assistant, palette  |

## Which file do I edit?

| I want to change…                                                                                                                                 | Edit                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| A new **internship / job**, a **certificate**, **education**, phone/email/links, languages                                                        | [`content/profile.ts`](../content/profile.ts) — once; the site **and** résumé update |
| A new **award**                                                                                                                                   | `profile.ts` → `recognition` **and** `content/resume.ts` → `achievements`            |
| **Résumé-only wording**: project bullets, skills groups, summary line under your name, achievements text, "last updated" date, which email prints | [`content/resume.ts`](../content/resume.ts)                                          |
| The **professional summary**                                                                                                                      | `profile.ts` → `summary`                                                             |

If you forget one, the checks tell you exactly what is missing (for example: _"Add 'Hackathon X' to achievements in content/resume.ts"_).

## The 4-step routine

```bash
pnpm resume --open     # 1. validate + build the PDF + check it is still ONE page, then open it
git add -A
git commit -m "docs(resume): add new internship"   # 2.
git push                                           # 3. Vercel rebuilds automatically
```

4. Check <https://vishalbg.vercel.app/resume> — it shows "Last updated <date>". Bump `updatedAt` in `content/resume.ts` whenever you change something.

`pnpm resume` fails loudly if the résumé spills onto a second page, a field is invalid, or the résumé and the site have drifted apart.

## Common edits

**New internship** — add an object to `experience` in `content/profile.ts`:

```ts
{ role: "…", company: "Company, City", period: "Jan 2027 – Mar 2027", current: false,
  points: ["Did X …", "Built Y …"] }
```

**New certificate** — add one line to `certifications` using the exact shape `Title — Issuer (YEAR)`.

**New project** — add it to `projects` in `profile.ts` (this also creates its site card and case-study slot), then either list it in `content/resume.ts → projects` with 1–3 bullets, or add it to `omittedProjects` with a reason.

**Change the email printed on the résumé** — `header.email` in `content/resume.ts`: `"primary"` (personal Gmail, the default) or `"college"`.

**Résumé too long?** Shorten a bullet or remove an item in `content/resume.ts`; `pnpm resume` tells you when it fits again.

## I edited a PDF somewhere else (Canva / Word / LaTeX)

```bash
pnpm resume:diff path/to/your-edited.pdf
```

It lists lines that are in **your** PDF but not in the generated one (copy them into `content/resume.ts` / `profile.ts`) and vice versa. Differences that are only line wrapping are ignored.

## Guardrails (so it stays ATS-friendly)

- One column, real selectable text, built-in Helvetica, **no images** — recruiter software can parse it.
- Don't add `letterSpacing` / `textTransform` to the PDF styles: it makes text extract as `S U M M A R Y`.
- Only characters in the Helvetica (WinAnsi) range are allowed; curly quotes (’) are added automatically.

Tip: you can also just ask Claude — _"add this internship to my résumé"_ — and it will edit these files and run the checks.
