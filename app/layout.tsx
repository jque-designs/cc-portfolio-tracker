import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CC Portfolio Tracker",
  description: "Market value and PnL for your CollectorCrypt cards and sealed products.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
