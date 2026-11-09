import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Voicela — Less clicking. More doing.",
  description:
    "A voice-first layer for your computer. Say what you need. See the plan. Stay in control.",
  applicationName: "Voicela",
  openGraph: {
    type: "website",
    title: "Voicela — Say what you need. Watch it happen.",
    description:
      "A voice-first layer for your computer. Say what you need. See the plan. Stay in control.",
    images: ["/og/og-1200x630.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Voicela — Say what you need. Watch it happen.",
    description:
      "A voice-first layer for your computer. Say what you need. See the plan. Stay in control.",
    images: ["/og/og-1200x630.png"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
