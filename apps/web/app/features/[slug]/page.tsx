import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/motion/reveal";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";

const features = {
  dictation: {
    name: "Dictation",
    title: "Your voice. A draft you can shape.",
    description: "Dictation is planned to turn spoken thoughts into editable text. Keep your attention on the idea, then check the draft before putting it to work.",
    example: "Draft a short update: the prototype is ready for review on Friday.",
    outcome: "Intended flow: capture speech, review the transcript, edit the draft, then choose where it goes.",
    capabilities: [
      ["Speech to a draft", "Turn a spoken thought into text you can inspect. Recognition quality and supported languages will depend on the models available in the desktop release."],
      ["Editable transcripts", "Correct names, punctuation and wording before using the text. The planned experience includes keyboard controls alongside voice input."],
      ["Deliberate placement", "Choose where the reviewed draft goes. App compatibility and text insertion are still being developed; universal support is not promised."],
      ["Clear recording controls", "The desktop plan calls for explicit microphone permissions and visible capture controls. This website does not record your microphone."],
    ],
  },
  agent: {
    name: "Agent",
    title: "Say the goal. Review the steps.",
    description: "The agent is intended to translate a request into a visible plan across supported apps. You should be able to understand what is proposed before approving consequential actions.",
    example: "Prepare a reply and find a time for a follow-up meeting.",
    outcome: "Illustrative flow: draft the reply, propose a meeting time, then ask for review before sending or scheduling.",
    capabilities: [
      ["Intent into a plan", "Break a request into understandable steps, with the proposed action and its target shown before execution."],
      ["Approval before consequences", "Require review for actions such as sending messages or changing files. Desktop approval boundaries are planned and are not implemented by this feature page."],
      ["Supported integrations", "Work through explicitly supported apps and approved integrations. The agent is not a replacement operating system and cannot control every application."],
      ["Visible outcomes", "Show whether a step completed, needs input or failed. The browser demo illustrates this with seeded data and performs no real actions."],
    ],
  },
  context: {
    name: "Context",
    title: "Let “this” mean something specific.",
    description: "Context is planned to help a request refer to information you deliberately share. A selected passage or document could give your words a useful reference without granting blanket access.",
    example: "Summarize this passage and pull out the decisions.",
    outcome: "Intended flow: choose the source, inspect what will be included, then use it for the request.",
    capabilities: [
      ["Chosen sources", "Use selected text or supported documents as a reference. Actual source types and app compatibility will depend on the desktop release."],
      ["Scoped screen context", "Explore screen-aware requests with explicit permission and a visible scope. This website does not read or capture your screen."],
      ["Review what is included", "Make the source of a request visible so you can correct missing or irrelevant information before continuing."],
      ["Control access", "The intended permission model lets you choose and revoke access. Persistent memory and unrestricted background observation are not claims made by this demo."],
    ],
  },
  automation: {
    name: "Automation",
    title: "A familiar task. Fewer repeated steps.",
    description: "Automation is planned to bring repeatable work into a reviewable sequence. Start with a small workflow, check its inputs and keep approval where the consequences matter.",
    example: "Group these project files and prepare a summary of the changes.",
    outcome: "Illustrative flow: select sample files, preview the proposed organization, then review each step before applying changes.",
    capabilities: [
      ["Reusable sequences", "The goal is to save a sequence of supported steps for work you repeat, with editable inputs for each run."],
      ["Preview before a run", "Show affected items and intended changes before proceeding. The file demo uses mock files and does not modify your device."],
      ["Approval checkpoints", "Keep review points for consequential changes instead of assuming a saved workflow grants permission for every future action."],
      ["Failure visibility", "Make incomplete steps and errors understandable. Scheduling, unattended execution and universal undo are not currently promised capabilities."],
    ],
  },
  privacy: {
    name: "Privacy",
    title: "A clear boundary around your data.",
    description: "Privacy starts with knowing what the experience can access. The browser demo uses sample data; the desktop plan calls for explicit permissions, a preference for local processing and informed opt-in for cloud processing.",
    example: "What information does this request need, and where will it be processed?",
    outcome: "Design goal: explain the source, permission and processing choice before sharing data or taking action.",
    capabilities: [
      ["Browser demo boundaries", "The current simulation does not record your microphone or access your real files, inbox or calendar. Its examples use seeded data."],
      ["Analytics by consent", "The site's analytics helper defaults to off and checks explicit consent for every event. Transcripts, email addresses and document contents must not be included in analytics payloads."],
      ["Processing choices", "Local processing is a desktop preference, not a guarantee. Hardware, models and task requirements affect availability; cloud processing is intended to require informed opt-in."],
      ["Permission controls", "Desktop access controls and revocation are planned. No certification, complete on-device processing or zero-retention guarantee is claimed here."],
    ],
  },
} as const;

type FeatureSlug = keyof typeof features;
type Props = { params: Promise<{ slug: string }> };

function getFeature(slug: string) {
  if (!Object.prototype.hasOwnProperty.call(features, slug)) notFound();
  return features[slug as FeatureSlug];
}

export function generateStaticParams() {
  return Object.keys(features).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const feature = getFeature((await params).slug);
  return {
    title: `${feature.name} | Voicela`,
    description: feature.description,
  };
}

export default async function FeaturePage({ params }: Props) {
  const feature = getFeature((await params).slug);

  return (
    <>
      <Navbar />
      <main id="main-content">
        <Container>
          <section className="border-b border-border py-12 sm:py-20 lg:py-24" aria-labelledby="feature-heading">
            <Link href="/features" className="mb-10 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={16} aria-hidden="true" />All features</Link>
            <Reveal>
              <p className="mb-5 text-sm font-medium text-accent">Voicela / {feature.name}</p>
              <h1 id="feature-heading" className="v-display max-w-5xl">{feature.title}</h1>
              <p className="mt-8 max-w-3xl text-lg leading-relaxed text-muted-foreground sm:text-xl">{feature.description}</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Badge variant="accent" dot>Windows alpha waitlist</Badge>
                <Badge variant="outline">macOS / Linux / Android / iOS planned</Badge>
              </div>
              <p className="mt-4 max-w-2xl text-sm text-muted-foreground">Desktop capabilities are in development. A waitlist is not download access, and no release date is promised.</p>
            </Reveal>
          </section>
        </Container>

        <Section aria-labelledby="example-heading" className="bg-muted">
          <div className="grid gap-8 lg:grid-cols-[1fr_2fr] lg:gap-16">
            <div>
              <h2 id="example-heading" className="text-2xl font-medium">{feature.name === "Privacy" ? "The question to ask" : "A request to imagine"}</h2>
              <p className="mt-3 text-sm text-muted-foreground">Illustrative scenario, not a live action.</p>
            </div>
            <div>
              <blockquote className="max-w-3xl font-serif text-3xl leading-snug sm:text-4xl">“{feature.example}”</blockquote>
              <p className="mt-6 max-w-2xl leading-relaxed text-muted-foreground">{feature.outcome}</p>
            </div>
          </div>
        </Section>

        <Section title={feature.name === "Privacy" ? "Current boundaries. Planned controls." : `Inside ${feature.name.toLowerCase()}`} subtitle="A closer look at the intended experience and its limits.">
          <dl className="border-t border-border">
            {feature.capabilities.map(([title, description], index) => (
              <div key={title} className="grid gap-4 border-b border-border py-7 sm:py-9 lg:grid-cols-[1fr_1.7fr_auto] lg:gap-10">
                <dt className="text-xl font-medium">{title}</dt>
                <dd className="max-w-prose leading-relaxed text-muted-foreground">{description}</dd>
                <dd><Badge variant="outline">{feature.name === "Privacy" && index < 2 ? "Website today" : "Planned"}</Badge></dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section className="border-t border-border" title="Explore it with sample data" subtitle="The interactive demo illustrates the idea in your browser. It does not perform real desktop actions.">
          <div className="flex flex-col items-start gap-3 sm:flex-row">
            <Button asChild><Link href="/demo">Try the interactive demo<ArrowUpRight size={16} aria-hidden="true" /></Link></Button>
            <Button asChild variant="outline"><a href="#footer-waitlist">View waitlist preview</a></Button>
          </div>
          <p className="mt-5 max-w-2xl text-sm text-muted-foreground">The waitlist form is a preview: it validates your email but does not store or send a registration.</p>
        </Section>
      </main>
      <Footer />
    </>
  );
}
