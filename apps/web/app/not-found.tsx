import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page not found",
  description: "The page you're looking for doesn't exist or has moved.",
};

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        404
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
        This page went quiet.
      </h1>
      <p className="max-w-md text-sm leading-relaxed text-zinc-400">
        The page you&apos;re looking for has been moved, renamed, or never
        existed. Let&apos;s get you back on track.
      </p>
      <Link
        href="/"
        className="mt-2 rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        Back to home
      </Link>
    </main>
  );
}
