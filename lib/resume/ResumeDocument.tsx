import { Document, Link, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { RESUME_SECTION_TITLES, type ResumeModel } from "./model";

/**
 * ATS-friendly PDF: centered header, plain black section headings with a thin rule, bold organisation
 * + right-aligned dates, italic roles, one page, no colour or decoration.
 * One column, real text, built-in Helvetica (no embedded fonts, no images). Every glyph must stay
 * inside WinAnsi (see tests/unit/resume.test.ts).
 *
 * Do not add `letterSpacing` or `textTransform`: react-pdf positions glyphs individually and
 * PDF text extraction then reads "S U M M A R Y", which ATS parsers can miss. Headings are
 * uppercased in JS instead.
 */
const NAVY = "#111111";
const INK = "#111111";
const MUTED = "#555555";
const GOLD = "#111111";

const s = StyleSheet.create({
  page: {
    paddingTop: 30,
    paddingBottom: 26,
    paddingHorizontal: 38,
    fontFamily: "Helvetica",
    fontSize: 8.4,
    lineHeight: 1.3,
    color: INK,
  },
  name: {
    fontFamily: "Helvetica-Bold",
    fontSize: 22,
    color: NAVY,
    textAlign: "center",
    lineHeight: 1.15,
  },
  subtitle: { fontSize: 8.6, color: MUTED, textAlign: "center", marginTop: 1 },
  contact: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 2.5,
    color: MUTED,
    fontSize: 8,
  },
  dot: { color: GOLD },
  link: { color: MUTED, textDecoration: "none" },
  headerRule: { borderBottomWidth: 1, borderBottomColor: "#888888", marginTop: 6 },
  section: { marginTop: 7 },
  heading: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.2,
    color: NAVY,
    borderBottomWidth: 0.7,
    borderBottomColor: "#888888",
    paddingBottom: 1.2,
    marginBottom: 3,
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  grow: { flex: 1, paddingRight: 8 },
  bold: { fontFamily: "Helvetica-Bold" },
  italic: { fontFamily: "Helvetica-Oblique", color: MUTED },
  role: { fontFamily: "Helvetica-Oblique", color: MUTED },
  muted: { color: MUTED },
  entry: { marginBottom: 3 },
  bulletRow: { flexDirection: "row", marginTop: 0.6, paddingLeft: 6 },
  dash: { width: 9 },
  bulletText: { flex: 1 },
  goldBullet: { width: 9, color: GOLD },
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.heading}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

const Dash = ({ items }: { items: string[] }) => (
  <>
    {items.map((t) => (
      <View key={t} style={s.bulletRow} wrap={false}>
        <Text style={s.dash}>•</Text>
        <Text style={s.bulletText}>{t}</Text>
      </View>
    ))}
  </>
);

export function ResumeDocument({ model }: { model: ResumeModel }) {
  const T = RESUME_SECTION_TITLES;
  return (
    <Document
      title={`${model.name} – Résumé`}
      author={model.name}
      subject="Full Stack Developer résumé"
      keywords="Full Stack Developer, Java, Spring Boot, JavaScript, TypeScript, React, Next.js, SQL, REST APIs, Firebase, Flutter, Generative AI, RAG"
      creator="vishalbg.vercel.app"
      producer="@react-pdf/renderer"
    >
      <Page size="A4" style={s.page}>
        <Text style={s.name}>{model.name}</Text>
        <Text style={s.subtitle}>{model.subtitle}</Text>
        <View style={s.contact}>
          {model.contact.map((c, i) => (
            <Text key={c.text}>
              {i > 0 ? <Text style={s.dot}>{"\u00A0\u00A0•\u00A0\u00A0"}</Text> : null}
              {c.href ? (
                <Link src={c.href} style={s.link}>
                  {c.text}
                </Link>
              ) : (
                c.text
              )}
            </Text>
          ))}
        </View>
        <View style={s.headerRule} />

        <Section title={T.summary}>
          <Text>{model.summary}</Text>
        </Section>

        <Section title={T.experience}>
          {model.experience.map((e) => (
            <View key={e.org + e.role} style={s.entry}>
              <View style={s.row}>
                <Text style={[s.bold, s.grow]}>{e.org}</Text>
                <Text style={s.italic}>{e.period}</Text>
              </View>
              <Text style={s.role}>{e.role}</Text>
              <Dash items={e.bullets} />
            </View>
          ))}
        </Section>

        <Section title={T.projects}>
          {model.projects.map((p) => (
            <View key={p.title} style={s.entry} wrap={false}>
              <View style={s.row}>
                <Text style={s.grow}>
                  <Text style={s.bold}>{p.title}</Text>
                  <Text style={s.bold}> | {p.stack}</Text>
                </Text>
                <Text style={s.italic}>{p.date}</Text>
              </View>
              <Dash items={p.bullets} />
            </View>
          ))}
        </Section>

        <Section title={T.skills}>
          {model.skills.map((g) => (
            <Text key={g.label} style={{ marginTop: 0.6 }}>
              <Text style={s.bold}>{g.label}: </Text>
              {g.text}
            </Text>
          ))}
        </Section>

        <Section title={T.education}>
          {model.education.map((e) => (
            <View key={e.line} style={{ marginBottom: 2 }}>
              <View style={s.row}>
                <Text style={[s.bold, s.grow]}>{e.school}</Text>
                <Text style={s.italic}>{e.period}</Text>
              </View>
              <Text style={s.muted}>{e.line}</Text>
            </View>
          ))}
        </Section>

        <Section title={T.certifications}>
          {model.certifications.map((c) => (
            <View key={c.title} style={[s.row, { marginTop: 0.6 }]}>
              <Text style={s.goldBullet}>•</Text>
              <Text style={s.grow}>
                <Text style={s.bold}>{c.title}</Text>
                <Text style={s.muted}> – {c.org}</Text>
              </Text>
              <Text style={s.italic}>{c.year}</Text>
            </View>
          ))}
        </Section>

        <Section title={T.achievements}>
          {model.achievements.map((a) => (
            <View key={a.title} style={[s.row, { marginTop: 0.6 }]} wrap={false}>
              <Text style={s.goldBullet}>•</Text>
              <Text style={s.grow}>
                <Text style={s.bold}>{a.title}</Text>
                <Text style={s.muted}> – {a.detail}</Text>
              </Text>
              <Text style={s.italic}>{a.date}</Text>
            </View>
          ))}
        </Section>

        {model.leadership.length > 0 ? (
          <Section title={T.leadership}>
            {model.leadership.map((l) => (
              <View key={l.title} style={s.entry}>
                <View style={s.row}>
                  <Text style={[s.bold, s.grow]}>{l.title}</Text>
                  <Text style={s.italic}>{l.date}</Text>
                </View>
                <Text style={s.role}>{l.role}</Text>
                <Dash items={l.bullets} />
              </View>
            ))}
          </Section>
        ) : null}
      </Page>
    </Document>
  );
}
