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
  title: "Terms draft | Voicela",
  description:
    "Draft terms for the Voicela preview, including acceptable use, demo limitations, no warranty, and the proposed ₹1 pilot.",
};

const sections = [
  {
    id: "preview",
    title: "The preview and these draft terms",
    paragraphs: [
      "Voicela’s website introduces a product under development and offers simulated interactions for evaluation. Features, supported platforms, availability, and commercial details may change. Examples are illustrative and should not be treated as a commitment to deliver a particular release or integration.",
      "These paragraphs are proposed terms for review, not a finalized agreement. The contracting entity, effective date, governing law, dispute process, and complete commercial conditions still need to be established. Visiting this page is not acceptance of an unspecified future contract.",
    ],
  },
  {
    id: "acceptable-use",
    title: "Acceptable use",
    paragraphs: [
      "Use the preview for lawful evaluation and only with information you are entitled to use. Do not use it to impersonate another person, distribute malicious material, harass others, infringe rights, or attempt unauthorized access to accounts, systems, or data.",
      "Do not disrupt the website, bypass access restrictions, or submit secrets and confidential third-party content through demonstration inputs. If you discover a possible security issue, stop testing before accessing other people’s information and look for a current reporting channel through the contact route below.",
    ],
  },
  {
    id: "demo-limits",
    title: "Simulations are not completed actions",
    paragraphs: [
      "The browser demo uses seeded files, messages, calendar entries, and chart values. A displayed message or meeting is not sent or created in your real account. The website does not request microphone access, and voice visuals do not indicate recording. Do not rely on the demo to complete real work.",
      "The waitlist form also simulates submission: it validates an email locally without storing or transmitting a registration. Its confirmation does not create an account, reserve a place, or guarantee an invitation. Review the privacy draft for the current data-handling boundaries.",
    ],
  },
  {
    id: "pilot",
    title: "The ₹1 pilot note",
    paragraphs: [
      "Any reference to a ₹1 pilot is an indicative early-access proposal, not a complete purchase offer. It does not establish the pilot’s duration, eligibility, included features, taxes, refund conditions, renewal terms, or a permanent price. Those details need to be stated clearly before payment is requested.",
      "This legal page does not collect payment or enroll you in a paid pilot. Do not infer a recurring charge or a future subscription commitment from the ₹1 reference. Any actual enrollment should present the total payable amount and any later charges for your explicit agreement before checkout.",
    ],
  },
  {
    id: "warranty",
    title: "No warranty for the preview",
    paragraphs: [
      "The proposed position is that the preview is provided as available, without a promise of uninterrupted access, error-free operation, accuracy, fitness for a particular purpose, or suitability for production work. Demonstration output may be incomplete or incorrect and should be independently checked before it informs a real decision.",
      "Do not use this preview as the sole basis for safety-critical, medical, legal, financial, or other consequential decisions. Final warranty and liability provisions require legal review and must preserve rights and protections that cannot lawfully be excluded. This draft does not set a monetary liability cap or remove statutory rights.",
    ],
  },
  {
    id: "content-and-changes",
    title: "Your content, changes, and questions",
    paragraphs: [
      "Only provide content you own or have permission to use. This draft does not establish a license to your private recordings, documents, or other work content. Any future connected service should explain the permissions it needs and the terms governing processing before you supply that content.",
      "A final version should publish a clear effective date and explain how material changes are communicated. A future paid service will need its own stated availability, cancellation, support, and refund conditions. Use the contact route below to look for a current channel for questions; no response time or service-level commitment is established here.",
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="bg-background text-foreground">
        <Container size="narrow" className="pt-16 sm:pt-24">
          <Reveal>
            <h1 className="text-5xl font-medium sm:text-6xl">Terms</h1>
            <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
              A working outline for using the preview, understanding its limits,
              and evaluating a possible pilot.
            </p>
          </Reveal>
          <Card variant="muted" className="mt-8">
            <Badge variant="outline" className="max-w-full whitespace-normal">
              Draft placeholder — not final legal text
            </Badge>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              These proposed terms need legal and commercial review. They are not
              a finalized agreement or a checkout offer.
            </p>
          </Card>
          <nav aria-label="Terms sections" className="mt-8 border-b border-border pb-8">
            <ul className="space-y-1">
              {sections.map(({ id, title }) => (
                <li key={id}>
                  <a href={`#${id}`} className="inline-flex min-h-11 items-center py-2 text-sm underline hover:text-accent">{title}</a>
                </li>
              ))}
            </ul>
          </nav>
        </Container>
        <Section aria-label="Terms draft" className="py-12 sm:py-16" containerClassName="max-w-3xl">
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
            <Link href="/security" className="inline-flex min-h-11 items-center underline hover:text-accent">Security draft</Link>
            <Link href="/contact" className="inline-flex min-h-11 items-center underline hover:text-accent">Contact</Link>
          </nav>
        </Section>
      </main>
      <Footer />
    </>
  );
}
