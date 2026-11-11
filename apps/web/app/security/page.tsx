import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Card } from "@/components/ui/card";
import { Reveal } from "@/components/motion/reveal";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "Security draft | Voicela",
  description:
    "Draft overview of Voicela security intentions, local processing, website permissions, and opt-in cloud processing.",
};

const sections = [
  {
    id: "local-processing",
    title: "Local processing is the preference",
    paragraphs: [
      "Voicela’s intended desktop experience favors processing on your device wherever practical. Keeping voice and work context close to you should reduce the amount of information that needs to leave your computer. This is a product direction, not a claim that every future feature will work offline.",
      "The website is a preview of that direction. It does not install a desktop agent, inspect your computer, or demonstrate a verified local speech-processing pipeline. Final documentation should identify which features run locally and which require a network connection before those features are offered.",
    ],
  },
  {
    id: "microphone",
    title: "This website does not access your microphone",
    paragraphs: [
      "The current website and browser demo do not request microphone permission or record audio. Voice visuals represent supplied or simulated activity; they are not evidence that the page is listening. You can explore the demo without speaking or granting audio access.",
      "Any future voice-enabled application should explain why microphone access is needed and request permission at the point of use. A website preview should never be treated as permission for a later application to listen.",
    ],
  },
  {
    id: "data-handling",
    title: "Demo data and real work stay distinct",
    paragraphs: [
      "The browser demo uses illustrative files, mail, calendar entries, and chart data. Its interactions do not authorize access to your own files or accounts, send external messages, or carry out real calendar actions. Avoid entering confidential information into a preview.",
      "The shared waitlist helper validates an email in the browser and simulates a response without storing or sending the registration. Analytics helpers default to no collection and must not receive emails, transcripts, or document contents. These boundaries describe this preview, not a future connected service.",
    ],
  },
  {
    id: "cloud",
    title: "Cloud processing should be an explicit choice",
    paragraphs: [
      "If a future feature needs cloud processing, the intended model is opt-in: explain what will be sent, the reason for sending it, and the available local alternative or limitation before a person chooses to proceed. Cloud processing is not enabled by accepting this draft or browsing these pages.",
      "Providers, storage locations, retention periods, and deletion controls are not established by this draft. Those details need to be documented for each connected feature before it handles real voice recordings or work content.",
    ],
  },
  {
    id: "permissions",
    title: "Permissions should follow the task",
    paragraphs: [
      "A future integration should ask only for the access needed for the action you selected. Reading a document, preparing a message, and sending that message are different actions and should have understandable boundaries. A simulated approval in the demo does not grant access to a real account.",
      "This page makes no claim of an independent security audit, certification, guaranteed encryption configuration, or vulnerability-free software. Verified controls and their limitations should replace these intentions as the product becomes available.",
    ],
  },
  {
    id: "reporting",
    title: "Reporting a concern",
    paragraphs: [
      "If something appears to expose information or behave outside the boundaries above, stop the interaction and use the contact route linked below to look for a current reporting channel. Do not include passwords, private recordings, access tokens, or other people’s data in an initial report.",
      "A dedicated security address, response expectations, and a coordinated disclosure policy still need to be published. This placeholder does not establish a bug bounty or promise a response time.",
    ],
  },
];

export default function SecurityPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background text-foreground">
        <Container size="narrow" className="pt-16 sm:pt-24">
          <Reveal>
            <h1 className="text-5xl font-medium sm:text-6xl">Security</h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              Where processing happens, what this preview can access, and the
              choices a future connected product should put in your hands.
            </p>
          </Reveal>
          <Card variant="muted" className="mt-8">
            <Badge variant="outline" className="max-w-full whitespace-normal">
              Draft placeholder — not final legal text
            </Badge>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              This working draft describes current preview boundaries and future
              intentions. It is not a security assurance or a final policy.
            </p>
          </Card>
          <nav aria-label="Security sections" className="mt-8 border-b border-border pb-8">
            <ul className="space-y-1">
              {sections.map(({ id, title }) => (
                <li key={id}>
                  <a href={`#${id}`} className="inline-flex min-h-11 items-center py-2 text-sm underline hover:text-accent">
                    {title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
        <Section aria-label="Security draft" className="py-12 sm:py-16" containerClassName="max-w-3xl">
          <div className="space-y-12">
            {sections.map(({ id, title, paragraphs }) => (
              <section key={id} id={id} aria-labelledby={`${id}-title`}>
                <h2 id={`${id}-title`} className="text-2xl font-medium sm:text-3xl">{title}</h2>
                {paragraphs.map((paragraph) => (
                  <p key={paragraph} className="mt-4 leading-7 text-muted-foreground">{paragraph}</p>
                ))}
              </section>
            ))}
          </div>
          <nav aria-label="Related policies" className="mt-12 flex flex-wrap gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
            <Link href="/privacy" className="inline-flex min-h-11 items-center underline hover:text-accent">Privacy draft</Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center underline hover:text-accent">Terms draft</Link>
            <Link href="/contact" className="inline-flex min-h-11 items-center underline hover:text-accent">Contact</Link>
          </nav>
        </Section>
      </main>
      <Footer />
    </>
  );
}
