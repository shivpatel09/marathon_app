import type { Metadata, Viewport } from "next";
import "./globals.css";
import { auth } from "@/lib/auth";
import TopNav from "@/components/TopNav";

export const metadata: Metadata = {
  title: "Marathon trainer",
  description: "Plan-driven marathon training with Strava feedback",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  return (
    <html lang="en">
      <body>
        {session?.user && <TopNav />}
        {children}
      </body>
    </html>
  );
}
