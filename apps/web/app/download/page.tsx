import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Monitor, Smartphone } from "lucide-react";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { Reveal } from "@/components/motion/reveal";
import { WindowsWaitlist } from "@/components/pages/platforms/windows-waitlist";

export const metadata: Metadata = {
  title: "Download & platforms — Voicela",
  description:
    "Windows alpha waitlist preview and Voicela’s planned platforms: macOS, Linux, Android and iOS. No installers are available yet.",
};

const plannedPlatforms = [
  { name: "macOS", kind: "desktop" },
  { name: "Linux", kind: "desktop" },
  { name: "Android", kind: "mobile" },
  { name: "iOS", kind: "mobile" },
];

export default function DownloadPage() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <Container className="pt-16 sm:pt-24">
          <Reveal>
            <h1 className="v-display max-w-4xl text-balance">
              Your voice.<br />Your device. In time.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              A deliberate rollout, starting with Windows. Desktop and mobile
              apps are still in development; no installers or binaries are
              available today.
            </p>
          </Reveal>
        </Container>

        <Section aria-label="Platform availability">
          <div className="grid gap-5 sm:grid-cols-2">
            <Card className="sm:col-span-2">
              <CardHeader className="flex flex-wrap items-start justify-between gap-4 space-y-0">
                <div>
                  <Monitor size={28} className="mb-5 text-accent" aria-hidden="true" />
                  <CardTitle className="text-3xl">Windows</CardTitle>
                </div>
                <Badge variant="accent">Alpha waitlist</Badge>
              </CardHeader>
              <CardContent>
                <p className="max-w-xl text-base leading-relaxed">
                  Our first planned desktop release. Alpha access, system
                  requirements and a release date have not been confirmed.
                </p>
                <p className="mt-6 font-medium text-foreground">Waitlist preview only</p>
                <p className="mt-2 max-w-xl leading-relaxed">
                  This preview validates your email locally. It does not save a
                  registration or send updates; the connected waitlist is still
                  in development.
                </p>
                <div className="mt-6 max-w-xl text-foreground">
                  <WindowsWaitlist />
                </div>
              </CardContent>
            </Card>
            {plannedPlatforms.map(({ name, kind }) => (
              <Card key={name} variant="outline">
                <CardHeader className="flex items-start justify-between gap-4 space-y-0">
                  <div>
                    {kind === "desktop" ? (
                      <Monitor size={24} className="mb-5 text-muted-foreground" aria-hidden="true" />
                    ) : (
                      <Smartphone size={24} className="mb-5 text-muted-foreground" aria-hidden="true" />
                    )}
                    <CardTitle>{name}</CardTitle>
                  </div>
                  <Badge variant="outline">Planned</Badge>
                </CardHeader>
                <CardContent>
                  No download available. Timing, requirements and supported
                  capabilities will be shared when confirmed.
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>

        <Section className="border-t border-border" title="Something to try today.">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-lg text-muted-foreground">
              Explore the browser demo with sample data. No installation or
              device access required.
            </p>
            <Button asChild variant="outline">
              <Link href="/demo">Try the browser demo <ArrowUpRight size={17} aria-hidden="true" /></Link>
            </Button>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
