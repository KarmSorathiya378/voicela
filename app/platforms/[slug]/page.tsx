import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { findPlatform, platforms } from "@/components/pages/platforms/data";
import { WindowsWaitlist } from "@/components/pages/platforms/windows-waitlist";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return platforms.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const platform = findPlatform((await params).slug);
  if (!platform) notFound();
  return {
    title: `Voicela for ${platform.name} — ${platform.status}`,
    description: platform.summary,
  };
}

export default async function PlatformPage({ params }: Props) {
  const platform = findPlatform((await params).slug);
  if (!platform) notFound();
  const windows = platform.slug === "windows";

  return (
    <>
      <Navbar />
      <main id="main-content">
        <Container className="pt-12 sm:pt-20">
          <Link href="/platforms" className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            All platforms
          </Link>
          <Reveal className="mt-10">
            <h1 className="v-display max-w-4xl text-balance">Voicela for {platform.name}.</h1>
            <div className="mt-6"><Badge variant={windows ? "accent" : "outline"} dot>{platform.status}</Badge></div>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">{platform.overview}</p>
          </Reveal>
        </Container>
        <Section aria-label={`${platform.name} roadmap and availability`}>
          <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-20">
            <div>
              <h2 className="text-3xl font-medium sm:text-4xl">What to expect</h2>
              <ul className="mt-6 list-disc space-y-4 pl-5 text-muted-foreground marker:text-accent">
                {platform.points.map((point) => <li key={point} className="pl-2 leading-relaxed">{point}</li>)}
              </ul>
              <p className="mt-8 max-w-xl text-sm text-muted-foreground">
                The browser demo uses sample data. It does not access your device’s apps, files or microphone.
              </p>
              <Button asChild variant="outline" className="mt-6"><Link href="/demo">Explore the browser demo</Link></Button>
            </div>
            <Card variant="muted">
              <CardHeader>
                <CardTitle>{windows ? "Try the Windows waitlist preview" : `${platform.name} is planned`}</CardTitle>
              </CardHeader>
              <CardContent>
                {windows ? <WindowsWaitlist /> : (
                  <div className="space-y-5 leading-relaxed">
                    <p>There is no {platform.name} download available today. We will share availability here when a release is ready.</p>
                    <p>No release date has been announced. For now, you can explore the browser demo or compare the platform roadmap.</p>
                    <Button asChild variant="outline"><Link href="/platforms">Compare platforms</Link></Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
