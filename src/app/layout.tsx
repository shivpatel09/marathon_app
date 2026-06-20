import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marathon trainer",
  description: "Plan-driven marathon training with Strava feedback",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
