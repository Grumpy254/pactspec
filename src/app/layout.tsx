import type { Metadata } from 'next';
import { DM_Sans, DM_Mono } from 'next/font/google';
import './globals.css';

const dmSans = DM_Sans({ variable: '--font-geist-sans', subsets: ['latin'], weight: ['400', '500', '600', '700'] });
const dmMono = DM_Mono({ variable: '--font-geist-mono', subsets: ['latin'], weight: ['400'] });

export const metadata: Metadata = {
  title: 'PactSpec — The open standard for AI agent trust',
  description:
    'An open standard for declaring AI agent capabilities, verifying they work, and discovering them. One JSON file. No platform lock-in.',
  openGraph: {
    title: 'PactSpec — The open standard for AI agent trust',
    description: 'Declare what your agent does, prove it works, state what it costs. Open standard with offline validation, any-registry publishing, and built-in verification.',
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
            <a href="/spec" className="hover:text-white transition-colors duration-200">Spec</a>
            <a href="/" className="hover:text-white transition-colors duration-200">Registry</a>
            <a href="/publish" className="hover:text-white transition-colors duration-200">Publish</a>
            <a href="/benchmarks" className="hover:text-white transition-colors duration-200">Benchmarks</a>
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
