import type { Metadata } from 'next';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { DemoLab } from '@/components/demo/demo-lab';

export const metadata: Metadata = {
  title: 'Interactive demo lab — Voicela',
  description: 'Explore a simulated desktop: find documents, draft mail, resolve calendar conflicts, and understand screen context. Every consequential action needs your approval.',
};

export default function DemoPage() {
  return <><Navbar /><main id="main-content"><DemoLab /></main><Footer /></>;
}
