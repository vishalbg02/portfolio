"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useNear } from "@/lib/hooks/use-near";
import type { ContactForm as Form } from "./ContactForm";

const ContactForm = dynamic(() => import("./ContactForm").then((m) => m.ContactForm), { ssr: false });

/** The contact form loads just before it scrolls into view. The email and phone buttons beside it are server-rendered. */
export function ContactFormLoader(props: ComponentProps<typeof Form>) {
  const [ref, near] = useNear<HTMLDivElement>("2000px 0px");
  return (
    <div ref={ref} data-island="contact-form" className="island-form">
      {near ? (
        <ContactForm {...props} />
      ) : (
        <Skeleton label="Loading the contact form" className="min-h-[inherit] border-0" />
      )}
    </div>
  );
}
