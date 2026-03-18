import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PactSpec — The trust layer for AI agents',
  description:
    'MCP connects agents. PactSpec makes them trustworthy. The open standard for declaring, verifying, and discovering AI agent capabilities — with pricing, test suites, and tamper-evident verification.',
  openGraph: {
    title: 'PactSpec — The trust layer for AI agents',
    description: 'MCP connects agents. PactSpec makes them trustworthy. Open standard for agent capability declaration with pricing, verified records, and machine-readable discovery.',
    url: 'https://pactspec.dev',
    siteName: 'PactSpec',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-950 text-gray-100 min-h-screen`}
      >
        <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 font-semibold text-white">
            <span className="text-indigo-400 font-mono text-xl font-bold tracking-tight">{'<PactSpec />'}</span>
          </a>
          <nav className="flex items-center gap-6 text-sm text-gray-400">
            <a href="/" className="hover:text-white transition-colors">Registry</a>
            <a href="/publish" className="hover:text-white transition-colors">Publish</a>
            <a href="/why" className="hover:text-white transition-colors">Why</a>
            <a href="/api/spec/v1" target="_blank" className="hover:text-white transition-colors">
              Schema
            </a>
            <a
              href="https://github.com/pactspec/pactspec"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-white transition-colors"
            >
              GitHub
            </a>
          </nav>
        </header>
        <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
        <footer className="border-t border-gray-800 mt-20 px-6 py-6 text-center text-gray-600 text-sm">
          PactSpec v1 &mdash; Open Protocol &mdash;{' '}
          <a href="/api/spec/v1" className="underline hover:text-gray-400">
            schema/v1.json
          </a>
        </footer>
      </body>
    </html>
  );
}
