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
  title: "Privacy draft | Voicela",
  description:
    "Draft explanation of Voicela’s website data handling, analytics consent, browser preferences, and simulated waitlist.",
};

const sections = [
  {
    id: "scope",
    title: "What this draft covers",
    paragraphs: [
      "This draft covers the current Voicela website and its simulated browser experiences. It distinguishes those experiences from a future desktop application or connected service. Browsing a product preview does not give Voicela permission to access your microphone, personal files, inbox, or calendar.",
      "The final policy still needs to identify the responsible legal entity, its contact details, relevant service providers, and applicable retention and rights procedures. This draft does not supply those missing details or claim to be a complete privacy notice.",
    ],
  },
  {
    id: "collection",
    title: "What the preview does and does not collect",
    paragraphs: [
      "The browser demo uses seeded, illustrative content. Its shared components do not capture microphone audio, read your local documents, connect to your email account, or execute external messages and calendar actions. Demo transcripts and examples should not be interpreted as recordings of your activity.",
      "Loading a website requires network requests. Hosting infrastructure may process technical request information such as IP addresses, requested paths, and browser headers. This draft does not verify hosting log configuration or retention, so it does not promise that visiting produces no technical records. Infrastructure details need to be confirmed in the final notice.",
    ],
  },
  {
    id: "consent",
    title: "Analytics consent is off by default",
    paragraphs: [
      "The shared analytics helper checks for an explicit granted preference before every event. Without that grant it does not collect or queue events, and unavailable browser storage leaves analytics off. Simply visiting, opening the demo, or submitting the waitlist preview is not analytics consent.",
      "In the current implementation, permitted events are written to the browser’s debug console rather than sent by this helper to an analytics service. Event payloads must not include email addresses, transcripts, or document contents. A future analytics integration should explain its provider, purpose, and withdrawal control before requesting consent; this draft does not activate such a service.",
    ],
  },
  {
    id: "waitlist",
    title: "Waitlist emails are not stored or sent",
    paragraphs: [
      "The waitlist is a local preview. When you submit an email, the helper trims and normalizes it, checks its format, and simulates a short delay. It returns a result to the page without storing the address in a signup database or sending it to a registration service.",
      "A success message therefore means the demonstration completed, not that you are subscribed or will receive an invitation. The address is handled temporarily in the browser during the interaction. If a real waitlist is connected later, the form and policy should explain its purpose, storage, email provider, and deletion or unsubscribe process before collecting registrations.",
    ],
  },
  {
    id: "preferences",
    title: "Browser preferences and your choices",
    paragraphs: [
      "The navigation can save an explicit theme choice under voicela:theme in local storage. The analytics helper uses voicela:analytics-consent to represent a granted or denied preference. These browser values serve different purposes: choosing a theme does not grant analytics consent.",
      "You can remove these values using your browser’s site-data controls. Removing the analytics preference returns the helper to its default off state; removing the theme value clears the saved theme choice. Clearing site data does not remove any separate hosting logs. This draft does not claim that a complete privacy-settings interface is already available.",
    ],
  },
  {
    id: "future-processing",
    title: "Future processing and privacy requests",
    paragraphs: [
      "The intended product favors local processing and an explicit choice before cloud features receive voice or work context. Any connected release needs a specific explanation of what leaves the device, who receives it, how long it is retained, and how users can manage or delete it. Those details are not settled by this preview.",
      "Use the contact route below to look for a current way to raise a privacy question. Avoid putting sensitive work content into an initial request. Before real registrations or connected processing begin, the final notice should publish a verified contact channel and explain how applicable access, correction, deletion, and consent requests will be handled.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background text-foreground">
        <Container size="narrow" className="pt-16 sm:pt-24">
          <Reveal>
            <h1 className="text-5xl font-medium sm:text-6xl">Privacy</h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              What the website handles today, what stays outside the preview,
              and where an explicit choice is required.
            </p>
          </Reveal>
          <Card variant="muted" className="mt-8">
            <Badge variant="outline" className="max-w-full whitespace-normal">
              Draft placeholder — not final legal text
            </Badge>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              This is a working explanation of the preview, pending review and
              confirmation of operational details. It is not the final privacy policy.
            </p>
          </Card>
          <nav aria-label="Privacy sections" className="mt-8 border-b border-border pb-8">
            <ul className="space-y-1">
              {sections.map(({ id, title }) => (
                <li key={id}>
                  <a href={`#${id}`} className="inline-flex min-h-11 items-center py-2 text-sm underline hover:text-accent">{title}</a>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
        <Section aria-label="Privacy draft" className="py-12 sm:py-16" containerClassName="max-w-3xl">
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
            <Link href="/security" className="inline-flex min-h-11 items-center underline hover:text-accent">Security draft</Link>
            <Link href="/terms" className="inline-flex min-h-11 items-center underline hover:text-accent">Terms draft</Link>
            <Link href="/contact" className="inline-flex min-h-11 items-center underline hover:text-accent">Contact</Link>
          </nav>
        </Section>
      </main>
      <Footer />
    </>
  );
}
