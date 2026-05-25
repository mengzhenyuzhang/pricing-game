import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Customer Valuations Game",
  description: "MBA revenue-management pricing game"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4">
            <Link href="/" className="text-lg font-bold text-navy">
              Customer Valuations Game
            </Link>
            <nav className="flex flex-wrap gap-2 text-sm">
              <Link className="btn-secondary" href="/join">Join</Link>
              <Link className="btn-secondary" href="/team">Team</Link>
              <Link className="btn-secondary" href="/scoreboard">Scoreboard</Link>
              <Link className="btn-secondary" href="/admin">Admin</Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
