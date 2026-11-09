import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/motion/reveal";
import { ContactForm } from "@/components/pages/contact/contact-form";

export const metadata: Metadata = {
  title: "Contact — Voicela",
  description: "Explore Voicela contact options and preview a message locally. This form does not send email or save your message.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main id="main-content">
        <Section className="pb-10 sm:pb-14">
          <Reveal className="max-w-3xl">
            <h1 className="v-display">What’s on your mind?</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">A question about the desktop plans, a workflow you want to try, or an idea for Voicela? Start with a message preview.</p>
          </Reveal>
        </Section>
        <Container className="pb-16 sm:pb-24">
          <div className="grid items-start gap-12 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-20">
            <Card>
              <CardHeader>
                <CardTitle>Preview your message</CardTitle>
                <p className="text-sm leading-relaxed text-muted-foreground">This form runs locally in your browser. It does not send email or save messages. Please leave out passwords and sensitive information.</p>
              </CardHeader>
              <CardContent className="text-foreground"><ContactForm /></CardContent>
            </Card>
            <aside aria-labelledby="contact-channels" className="min-w-0">
              <h2 id="contact-channels" className="text-2xl font-medium">Contact channels</h2>
              <dl className="mt-6 divide-y divide-border border-y border-border text-sm">
                <div className="py-6">
                  <dt className="font-medium">Product questions & feedback</dt>
                  <dd className="mt-2 leading-relaxed text-muted-foreground">Use the preview to prepare your message. A monitored email address or support inbox has not been published on this site yet; the preview cannot reach the team.</dd>
                </div>
                <div className="py-6">
                  <dt className="font-medium">Windows alpha interest</dt>
                  <dd className="mt-2 leading-relaxed text-muted-foreground">The <Link href="#footer-waitlist" className="text-accent underline underline-offset-4">waitlist preview below</Link> shows the intended signup flow. It does not register you or send updates. A live signup channel is still planned.</dd>
                </div>
                <div className="py-6">
                  <dt className="font-medium">Answers & development notes</dt>
                  <dd className="mt-2 leading-relaxed text-muted-foreground">Read the <Link href="/faq" className="text-accent underline underline-offset-4">FAQ</Link> for current limitations, or the <Link href="/changelog" className="text-accent underline underline-offset-4">draft changelog</Link> for roadmap context.</dd>
                </div>
              </dl>
              <div className="mt-6"><Badge variant="outline">No response time promised</Badge></div>
            </aside>
          </div>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
