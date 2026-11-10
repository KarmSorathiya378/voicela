import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, AudioLines, ShieldCheck } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Accordion } from "@/components/ui/accordion";
import { ProductStory } from "@/components/home/product-story";
import "@/components/home/premium.css";

export const metadata: Metadata = {
  title: "Voicela — A voice assistant for your work",
  description: "From a spoken thought to a draft you can review. Experience Voicela's voice-first workflows in a free, interactive browser demo.",
  other: { "page-type": "software", "site-kind": "software" },
};
const questions = [
  { question: "What can I try today?", answer: "The free browser demo includes authored workflows for email, calendars, files, dictation and selected context. It uses fictional data, does not connect to your accounts and never records your microphone." },
  { question: "Is the desktop app available?", answer: "Windows is the first planned desktop release. macOS, Linux and mobile have separate roadmaps. There is no confirmed release date or signed download yet." },
  { question: "Will Voicela send things without asking?", answer: "The proposed desktop experience lets you review consequential actions before they happen. In today's demo, drafts and approvals are simulated; no real message is sent." },
  { question: "How much will it cost?", answer: "Desktop pricing is still being developed. A ₹1 introductory offer is under consideration, but its duration, usage allowance, taxes and renewal terms are not confirmed. No payment is collected today." },
];

export default function Home() {
  return (
    <div className="premium-home">
      <Navbar />
      <main id="main-content">
        <section className="premium-hero premium-wrap" aria-labelledby="hero-heading">
          <div className="hero-copy" data-enter>
            <p className="edition"><span /> The voice-first workspace</p>
            <h1 id="hero-heading">A voice assistant.<br />For your <em>real work.</em></h1>
            <p className="hero-lead">Turn a thought into a reply, a plan, a next step. Say what you need. Review what happens next.</p>
            <div className="premium-actions">
              <Link className="premium-button" href="/demo">Try the demo <ArrowUpRight size={18} /></Link>
              <a className="premium-link" href="#how-it-works">See how it works <ArrowRight size={17} /></a>
            </div>
            <p className="hero-note">Free browser demo. No account required.<br />Desktop app in development.</p>
          </div>
          <div className="hero-product" data-enter>
            <Image src="/images/voicela-coast.webp" alt="" fill preload sizes="(min-width: 1024px) 55vw, 100vw" className="coast-image" />
            <ProductStory />
          </div>
        </section>
        <section id="how-it-works" className="premium-section workflow-section">
          <div className="premium-wrap">
            <div className="section-intro"><p className="edition">01 / From intent to action</p><h2>The thought is yours.<br />The next steps, <em>together.</em></h2><p>Less moving between windows. More attention on the work. Explore a request from the first words to a draft you can edit.</p></div>
            <div className="workflow-editor" data-ui>
              <div className="workflow-request"><AudioLines size={26} /><p>“Read the project update.<br />Find a time. Draft a reply.”</p><span>One request · three connected steps</span></div>
              <div className="workflow-result"><div className="result-top"><span><span className="status-dot" /> Draft ready</span><span>Demo workspace</span></div><p className="mail-to">To: Maya Chen <span>Subject: Project review</span></p><p>Hi Maya,</p><p>Thanks for the update. Friday at 2 PM works for a review. I’ll bring the revised project brief.</p><div className="approval-line"><ShieldCheck size={18} /> Ready for your review. Nothing sent.</div></div>
            </div>
            <div className="workflow-foot"><span>Fictional data. No connected accounts.</span><Link className="premium-link" href="/demo">Try this workflow <ArrowUpRight size={17} /></Link></div>
          </div>
        </section>
        <section className="premium-section studio-section">
          <div className="premium-wrap studio-grid">
            <div className="studio-copy"><p className="edition">02 / Space for your thinking</p><h2>Keep your mind<br />on the <em>good part.</em></h2><p>The idea. The conversation. The work you sat down to do. Voicela is being built to help with the steps in between.</p><div className="feature-rows"><Link href="/features/dictation"><span>01</span><div><h3>Give your thoughts a first draft</h3><p>Turn spoken notes into text you can shape.</p></div><ArrowUpRight size={18} /></Link><Link href="/features/screen-context"><span>02</span><div><h3>Start with the right context</h3><p>Select a passage. Ask about what matters.</p></div><ArrowUpRight size={18} /></Link><Link href="/features/voice-actions"><span>03</span><div><h3>Move the task forward</h3><p>Follow a clear plan across sample apps.</p></div><ArrowUpRight size={18} /></Link></div></div>
            <div className="studio-photo"><Image src="/images/voicela-studio.webp" alt="A quiet sunlit workspace with a laptop, notebook and ceramic cup on an oak desk" fill sizes="(min-width: 1024px) 50vw, 100vw" /></div>
          </div>
        </section>
        <section className="premium-section control-section">
          <div className="premium-wrap control-grid"><div><p className="edition">03 / Your permission comes first</p><h2>A capable assistant.<br /><em>Your call.</em></h2><p>Good assistance should feel reassuring. The proposed desktop experience is built around visible context, editable drafts and deliberate approvals.</p><Link href="/security" className="premium-link">Read about control <ArrowRight size={18} /></Link></div><div className="permission-sheet" data-ui><div className="permission-title"><ShieldCheck size={24} /><span>You’re in control</span></div>{[["Context", "Only what you choose to share"], ["Drafts", "Review and edit before continuing"], ["Actions", "Approve consequential changes"]].map(([title, detail]) => <div className="permission-row" key={title}><div><h3>{title}</h3><p>{detail}</p></div><Check size={19} /></div>)}<p className="permission-note">Desktop design preview · no device access</p></div></div>
        </section>
        <section className="premium-section questions-section"><div className="premium-wrap questions-grid"><div><p className="edition">A little clarity</p><h2>Before your<br /><em>first request.</em></h2><p>Try what’s here today.<br />Know what’s coming next.</p><Link className="premium-link" href="/pricing">See pricing plans <ArrowUpRight size={17} /></Link></div><Accordion items={questions} /></div></section>
      </main>
      <footer className="premium-footer"><div className="premium-wrap"><div className="closing"><p className="edition">Meet your next way of working</p><h2>Make room for<br /><em>your next idea.</em></h2><Link href="/demo" className="premium-button">Try the demo <ArrowUpRight size={18} /></Link><p>Explore the free simulation. No payment required.</p></div><div className="footer-bottom"><Link href="/" className="premium-brand"><AudioLines size={24} /> voicela.</Link><nav aria-label="Footer navigation"><Link href="/platforms">Platforms</Link><Link href="/pricing">Pricing</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/contact">Contact</Link></nav><span>© 2026 Voicela</span></div></div></footer>
    </div>
  );
}
