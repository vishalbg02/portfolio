import "server-only";
import { features } from "@/lib/env";
import { sendOwnerEmail } from "@/lib/email/send";
import { startConversation } from "@/lib/live/service";
import { ownerPing, sendTelegram, type OwnerPing } from "./telegram";

export type Channel = "telegram" | "email";
export type Delivery = { attempted: Channel[]; delivered: Channel[] };

type Deps = {
  telegram: (m: OwnerPing) => Promise<boolean>;
  email: (m: OwnerPing) => Promise<void>;
};
const real: Deps = {
  // With live chat configured, a confirmed GRID message becomes a conversation, so Vishal's Telegram reply reaches the
  // visitor by email if they have left. Otherwise it is a one-off ping.
  telegram: async (m) =>
    features.live
      ? (
          await startConversation({
            name: m.name,
            email: m.email,
            org: null,
            message: m.message,
            page: m.page ?? "/",
            ipHash: m.ipHash ?? "grid",
            via: "grid",
          })
        ).ok
      : sendTelegram(ownerPing(m)),
  email: (m) =>
    sendOwnerEmail({ name: m.name, email: m.email, message: m.message }, "GRID, the chat on the site"),
};

/**
 * Delivers a visitor's message to Vishal on every channel that is configured (his phone through Telegram, his inbox
 * through email). The message counts as delivered if at least one of them took it. Only counts are ever logged.
 */
export async function deliverToVishal(m: OwnerPing, deps: Partial<Deps> = {}): Promise<Delivery> {
  const d = { ...real, ...deps };
  const attempted: Channel[] = [
    ...(features.telegram ? (["telegram"] as const) : []),
    ...(features.email ? (["email"] as const) : []),
  ];
  const jobs = attempted.map(async (c): Promise<Channel | null> => {
    try {
      if (c === "telegram") return (await d.telegram(m)) ? "telegram" : null;
      await d.email(m);
      return "email";
    } catch (err) {
      console.error(`[notify] ${c} failed:`, (err as Error).message);
      return null;
    }
  });
  const delivered = (await Promise.all(jobs)).filter((c): c is Channel => c !== null);
  console.info(
    "[notify]",
    JSON.stringify({ route: "grid-message", attempted: attempted.length, delivered: delivered.length }),
  );
  return { attempted, delivered };
}
