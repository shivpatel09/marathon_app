"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICON = {
  week: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 3v3M16 3v3" />
    </svg>
  ),
  runs: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2-6 4 12 2-6h6" />
    </svg>
  ),
  strength: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10" />
    </svg>
  ),
  nutrition: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c2.5 3 4 5 4 8a4 4 0 0 1-8 0c0-2.2 1.3-4 2.5-5.5.4 1 1 1.6 1.8 2C12 6.5 11.5 5 12 3z" />
    </svg>
  ),
  review: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21V11M12 21V5M19 21v-7" />
      <path d="M3.5 21h17" />
    </svg>
  ),
};

const TABS = [
  { href: "/week", label: "Week", icon: ICON.week },
  { href: "/runs", label: "Runs", icon: ICON.runs },
  { href: "/strength", label: "Strength", icon: ICON.strength },
  { href: "/nutrition", label: "Nutrition", icon: ICON.nutrition },
  { href: "/review", label: "Review", icon: ICON.review },
];

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(`${t.href}/`);
        return (
          <Link key={t.href} href={t.href} className={`bn-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
            <span className="bn-icon">{t.icon}</span>
            <span className="bn-label">{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
