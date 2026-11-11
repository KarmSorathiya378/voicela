import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ConsentBanner from "@/components/consent/consent-banner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const SITE_URL = "https://voicela.vercel.app";
const SITE_DESCRIPTION =
  "A voice-first layer for your computer. Say what you need. See the plan. Stay in control.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Voicela — Less clicking. More doing.",
    template: "%s · Voicela",
  },
  description: SITE_DESCRIPTION,
  applicationName: "Voicela",
  openGraph: {
    type: "website",
    siteName: "Voicela",
    title: "Voicela — Say what you need. Watch it happen.",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: "/og/og-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Voicela — say what you need, watch it happen",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Voicela — Say what you need. Watch it happen.",
    description: SITE_DESCRIPTION,
    images: ["/og/og-1200x630.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <ConsentBanner />
      </body>
    </html>
  );
}
