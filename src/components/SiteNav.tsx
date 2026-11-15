"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "./ui";

type Item = { href: string; label: string; match: (p: string) => boolean };

function items(signedIn: boolean, discover: boolean): Item[] {
  const out: Item[] = [];
  if (signedIn) out.push({ href: "/plans", label: "My plans", match: (p) => p === "/plans" || p.startsWith("/plans/") || p.startsWith("/welcome") });
  if (discover) out.push({ href: "/discover", label: "Discover", match: (p) => p.startsWith("/discover") || p.startsWith("/events/") });
  return out;
}

/** Top navigation on the cardinal bar: the current section gets a gold underline. */
export function MainNav({ signedIn, discover }: { signedIn: boolean; discover: boolean }) {
  const pathname = usePathname() ?? "";
  const list = items(signedIn, discover);
  if (!list.length) return null;
  return (
    <nav aria-label="Main" className="hidden items-stretch gap-6 self-stretch sm:flex">
      {list.map((it) => {
        const on = it.match(pathname);
        return (
          <Link
            key={it.href}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={cx(
              "flex items-center border-b-[3px] pt-[3px] text-[15px] transition-colors",
              on ? "border-gold font-bold text-white" : "border-transparent font-medium text-white/80 hover:text-white",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}

const ICONS: Record<string, React.ReactNode> = {
  "My plans": <path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8" />,
  Discover: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12z" />
    </>
  ),
  Settings: (
    <>
      <path d="M20 7h-9M14 17H5" />
      <circle cx="17" cy="17" r="3" />
      <circle cx="7" cy="7" r="3" />
    </>
  ),
};

/**
 * Mobile tab bar (My plans · Discover · Settings) for signed-in users. Hidden inside a plan,
 * where the sticky Edit details / Save bar takes the bottom of the screen instead.
 */
export function BottomNav({ discover }: { discover: boolean }) {
  const pathname = usePathname() ?? "";
  if (/^\/(plans|demo)\/(?!new)[^/]+/.test(pathname)) return null;
  const list = [...items(true, discover), { href: "/settings", label: "Settings", match: (p: string) => p.startsWith("/settings") }];
  return (
    <>
      <div aria-hidden className="h-[72px] sm:hidden" />
      <nav aria-label="Main" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card pb-[env(safe-area-inset-bottom)] sm:hidden">
        <ul className="flex">
          {list.map((it) => {
            const on = it.match(pathname);
            return (
              <li key={it.href} className="flex-1">
                <Link href={it.href} aria-current={on ? "page" : undefined} className="relative flex flex-col items-center gap-1 pt-3 pb-2">
                  <span aria-hidden className={cx("absolute top-0 h-[3px] w-7 rounded-full", on ? "bg-gold" : "bg-transparent")} />
                  <svg aria-hidden width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={on ? "text-cardinal" : "text-muted"}>
                    {ICONS[it.label]}
                  </svg>
                  <span className={cx("text-xs", on ? "font-bold text-cardinal" : "font-medium text-muted")}>{it.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
