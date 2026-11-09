"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, AudioLines, Menu, Moon, Sun, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";

const links = [
  { href: "/features", label: "Product" },
  { href: "/demo", label: "Interactive Demo" },
  { href: "/download", label: "Platforms" },
  { href: "/pricing", label: "Pricing" },
  { href: "/security", label: "About / Docs" },
];
export { Navbar };
export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const toggle = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem("voicela:theme");
    } catch {
      /* Private browsing. */
    }
    const active = saved
      ? saved === "dark"
      : document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", active);
    // Theme is read after hydration to keep server markup deterministic.
    queueMicrotask(() => setDark(active));
  }, []);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        toggle.current?.focus();
      }
    };
    const onOutside = (event: PointerEvent) => {
      if (
        !panel.current?.contains(event.target as Node) &&
        !toggle.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (media.matches) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    media.addEventListener("change", closeOnDesktop);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
      media.removeEventListener("change", closeOnDesktop);
    };
  }, [open]);
  function changeTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("voicela:theme", next ? "dark" : "light");
    } catch {
      /* Theme still works in memory. */
    }
  }
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-5 focus:top-3 focus:z-50 focus:bg-background focus:p-3"
      >
        Skip to content
      </a>
      <Container className="flex min-h-20 items-center justify-between gap-5">
        <Link
          href="/"
          aria-label="Voicela home"
          className="flex min-h-11 items-center gap-2.5 text-xl font-semibold tracking-[-0.04em]"
        >
          <AudioLines aria-hidden="true" size={25} strokeWidth={1.7} />
          voicela
          <span aria-hidden="true" className="text-accent">
            .
          </span>
        </Link>
        <nav
          aria-label="Main navigation"
          className="hidden items-center gap-6 lg:flex"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              className="inline-flex min-h-11 items-center text-xs font-medium text-muted-foreground transition-colors hover:text-foreground aria-[current=page]:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label={dark ? "Use light theme" : "Use dark theme"}
            onClick={changeTheme}
          >
            {dark ? <Sun size={17} /> : <Moon size={17} />}
          </Button>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link href="/demo">
              Try Interactive Demo
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </Button>
          <Button
            ref={toggle}
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-expanded={open}
            aria-controls="mobile-navigation"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={21} /> : <Menu size={21} />}
          </Button>
        </div>
      </Container>
      <div
        ref={panel}
        id="mobile-navigation"
        hidden={!open}
        className="border-t border-border bg-background lg:hidden"
      >
        <Container className="py-4">
          <nav aria-label="Mobile navigation" className="flex flex-col">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === link.href ? "page" : undefined}
                className="flex min-h-12 items-center py-2 text-sm text-muted-foreground aria-[current=page]:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Button asChild className="mt-3 self-start">
              <Link href="/demo" onClick={() => setOpen(false)}>
                Try Interactive Demo
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            </Button>
          </nav>
        </Container>
      </div>
    </header>
  );
}
