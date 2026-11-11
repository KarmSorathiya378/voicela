import type { Metadata } from "next";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Card } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/motion/reveal";
import { WaitlistForm } from "@/components/pages/waitlist/waitlist-form";

export const metadata: Metadata = {
  title: "Join the waitlist — Voicela",
  description:
    "Record your interest in Voicela's planned desktop launch. No payment is requested. Windows is the first priority; other platforms and launch dates remain pending.",
};

export default function WaitlistPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <main id="main-content">
        <Section className="pb-10 sm:pb-14">
          <Reveal className="max-w-3xl">
            <h1 className="v-display">Join the waitlist.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Record your interest in the planned Voicela desktop launch. No
              payment is involved. Windows is the first priority; macOS, Linux,
              Android, and iOS remain pending on the roadmap. Launch dates are
              still pending.
            </p>
          </Reveal>
        </Section>
        <Container className="pb-16 sm:pb-24">
          <Card className="max-w-2xl">
            <h2 className="mb-6 text-xl font-medium">Record your interest</h2>
            <WaitlistForm />
          </Card>
        </Container>
      </main>
      <Footer />
    </div>
  );
}
