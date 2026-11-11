import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import Navbar from "@/components/layout/navbar";
import Footer from "@/components/layout/footer";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Container } from "@/components/ui/container";
import { Section } from "@/components/ui/section";
import { platforms } from "@/components/pages/platforms/data";

export const metadata: Metadata = {
  title: "Platforms — Voicela",
  description: "Explore Voicela’s platform roadmap for Windows, macOS, Linux, Android and iOS. Native apps are planned; Windows offers a local waitlist preview only.",
};

export default function PlatformsPage() {
  return (
    <>
      <Navbar />
      <main id="main-content">
        <Container className="pt-16 sm:pt-24">
          <Reveal>
            <h1 className="v-display max-w-4xl text-balance">Your platform.<br />Our next steps.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Windows comes first in our desktop plans. Mac, Linux and mobile
              follow their own readiness milestones. See what is planned for your device.
            </p>
            <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
              Native apps are not available yet. Release dates and system requirements have not been announced.
            </p>
          </Reveal>
        </Container>
        <Section aria-label="Platform availability">
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {platforms.map((platform) => (
              <Card key={platform.slug} className="flex h-full flex-col">
                <CardHeader>
                  <Badge variant={platform.slug === "windows" ? "accent" : "outline"} dot>
                    {platform.status}
                  </Badge>
                  <CardTitle className="pt-4 text-2xl">
                    <Link href={`/platforms/${platform.slug}`} className="rounded-sm hover:underline underline-offset-4">
                      {platform.name}
                    </Link>
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col items-start gap-6">
                  <div className="w-full overflow-hidden rounded-lg border border-border">
                    <Image
                      src={`/images/platform-${platform.slug}.png`}
                      alt={`Voicela on ${platform.name} — platform tile`}
                      width={960}
                      height={720}
                      loading="lazy"
                      sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  </div>
                  <p className="flex-1 leading-relaxed">{platform.summary}</p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/platforms/${platform.slug}`}>
                      Explore {platform.name}<ArrowUpRight aria-hidden="true" className="ml-2 size-4" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mt-12 flex flex-col items-start gap-5 border-t border-border pt-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xl text-muted-foreground">Get a feel for the idea today with our browser simulation.</p>
            <Button asChild variant="secondary"><Link href="/demo">Try the browser demo</Link></Button>
          </div>
        </Section>
      </main>
      <Footer />
    </>
  );
}
