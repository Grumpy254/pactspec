import type { Metadata } from 'next';
import { DM_Sans, DM_Mono } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({ variable: '--font-geist-sans', subsets: ['latin'], weight: ['400', '500', '600', '700'] });
const dmMono = DM_Mono({ variable: '--font-geist-mono', subsets: ['latin'], weight: ['400'] });

export const metadata: Metadata = {
  title: 'PactSpec — Know if your AI agent actually works',
  description:
    'Test your AI agents against real benchmarks, verify pricing, and track quality over time. Open protocol with registry, CLI, and framework integrations.',
  openGraph: {
    title: 'PactSpec — Know if your AI agent actually works',
    description: 'Run tests against live agent endpoints, score against domain-specific benchmarks, verify pricing, and track quality. Open protocol for AI agent trust.',
    url: 'https://pactspec.dev',
    siteName: 'PactSpec',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${dmMono.variable} antialiased min-h-screen`}
        style={{ background: 'var(--background)', color: 'var(--foreground)' }}
      >
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0a0a0f]/80 border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-semibold text-white">
            <span className="gradient-text font-mono text-xl font-bold tracking-tight">{'<PactSpec />'}</span>
          </a>
          <nav className="flex items-center gap-6 text-sm text-gray-400">
            <a href="/" className="hover:text-white transition-colors duration-200">Registry</a>
            <a href="/publish" className="hover:text-white transition-colors duration-200">Publish</a>
            <div className="relative group">
              <span className="hover:text-white transition-colors duration-200 cursor-default">Docs</span>
              <div className="absolute top-full right-0 mt-2 w-52 bg-[#111117] border border-white/[0.08] rounded-xl shadow-2xl shadow-black/50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 py-1">
                <a href="/why" className="block px-4 py-2.5 text-sm hover:bg-white/[0.04] hover:text-white transition-colors">Why PactSpec</a>
                <a href="/pricing" className="block px-4 py-2.5 text-sm hover:bg-white/[0.04] hover:text-white transition-colors">Pricing &amp; Monetization</a>
                <a href="/benchmarks" className="block px-4 py-2.5 text-sm hover:bg-white/[0.04] hover:text-white transition-colors">Benchmarks</a>
                <a href="/guides/stripe-setup" className="block px-4 py-2.5 text-sm hover:bg-white/[0.04] hover:text-white transition-colors">Stripe Setup Guide</a>
                <a href="/openclaw" className="block px-4 py-2.5 text-sm hover:bg-white/[0.04] hover:text-white transition-colors">OpenClaw Skills</a>
                <div className="border-t border-white/[0.06] my-1" />
                <a href="/api/spec/v1" target="_blank" rel="noopener noreferrer" className="block px-4 py-2.5 text-sm hover:bg-white/[0.04] hover:text-white transition-colors text-gray-500">Schema (JSON)</a>
              </div>
            </div>
            <a href="/demo" className="hover:text-white transition-colors duration-200">Demo</a>
            <a
              href="https://github.com/Grumpy254/pactspec"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors duration-200"
            >
              GitHub
            </a>
          </nav>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-12">{children}</main>
        <footer className="border-t border-white/[0.06] mt-24 px-6 py-8 text-center text-gray-600 text-sm">
          PactSpec v1 &mdash; Open Protocol &mdash;{' '}
          <a href="/api/spec/v1" className="text-gray-500 hover:text-gray-300 transition-colors">
            schema/v1.json
          </a>
        </footer>
      </body>
    </html>
  );
}
