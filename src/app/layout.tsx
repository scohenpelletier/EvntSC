import type { Metadata } from "next";
import { Hanken_Grotesk, Libre_Caslon_Text } from "next/font/google";
import Link from "next/link";
import { AccountMenu } from "@/components/AccountMenu";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { BottomNav, MainNav } from "@/components/SiteNav";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getUser } from "@/lib/supabase/server";
import { troyLensEnabled } from "@/lib/troylens/card";
import "./globals.css";

// Brand faces are Adobe Caslon Pro (display) and National 2 (sans) — both licensed.
// Free stand-ins load by default: Libre Caslon Text and Hanken Grotesk.
// NEXT_PUBLIC_ADOBE_FONTS_KIT loads Adobe Caslon Pro; NEXT_PUBLIC_SELF_HOSTED_FONTS=true loads
// National 2 from public/fonts (see public/fonts/brand-fonts.css).
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"] });
const caslon = Libre_Caslon_Text({ variable: "--font-caslon", subsets: ["latin"], weight: ["400", "700"] });
const adobeKit = process.env.NEXT_PUBLIC_ADOBE_FONTS_KIT?.match(/^[a-z0-9]{5,12}$/i)?.[0];
const selfHostedFonts = process.env.NEXT_PUBLIC_SELF_HOSTED_FONTS === "true";

// Every page depends on the request session and runtime configuration; never prerender account UI.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "EvntSC",
  description: "Turn a USC workshop idea into a reviewable plan. Independent student-built prototype; not affiliated with or endorsed by USC.",
};

function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`font-display font-bold tracking-tight ${className ?? ""}`}>
      Evnt<span className="text-gold">SC</span>
    </span>
  );
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const configured = isSupabaseConfigured();
  const user = configured ? await getUser() : null;
  const discover = troyLensEnabled();
  return (
    <html lang="en" className={`${hanken.variable} ${caslon.variable} h-full antialiased`}>
      {(adobeKit || selfHostedFonts) && (
        <head>
          {adobeKit && <link rel="stylesheet" href={`https://use.typekit.net/${adobeKit}.css`} />}
          {selfHostedFonts && <link rel="stylesheet" href="/fonts/brand-fonts.css" />}
        </head>
      )}
      <body className="flex min-h-full flex-col">
        <ConfirmProvider>
          <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">
            Skip to content
          </a>
          <header className="no-print on-cardinal border-b-4 border-gold bg-cardinal text-white">
            <div className="mx-auto flex min-h-16 max-w-6xl items-stretch justify-between gap-3 px-4 sm:px-6">
              <div className="flex items-stretch gap-8">
                <div className="flex items-center gap-2.5">
                  <Link href={user ? "/plans" : "/"} className="text-2xl leading-none" aria-label="EvntSC home">
                    <Wordmark />
                  </Link>
                  <span className="hidden rounded border border-gold/70 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gold md:inline">
                    Student prototype
                  </span>
                </div>
                <MainNav signedIn={!!user} discover={discover} />
              </div>
              <div className="flex items-center">
                {user ? (
                  <AccountMenu email={user.email} />
                ) : configured ? (
                  <div className="flex items-center gap-2 text-sm">
                    <Link href="/sign-in" className="rounded-md px-3 py-2 font-semibold text-white hover:bg-white/10">
                      Sign in
                    </Link>
                    <Link href="/sign-up" className="rounded-md bg-gold px-3.5 py-2 font-bold text-cardinal-deep hover:bg-gold-soft">
                      Create account
                    </Link>
                  </div>
                ) : (
                  <Link href="/setup" className="rounded-full bg-gold-wash px-3 py-1 text-xs font-bold text-cardinal-deep">
                    Accounts not configured
                  </Link>
                )}
              </div>
            </div>
          </header>
          <main id="main" className="flex-1">
            {children}
          </main>
          <footer className="no-print on-cardinal bg-cardinal-deep text-white">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-7 sm:flex-row sm:items-center sm:gap-10 sm:px-6">
              <Wordmark className="text-xl" />
              <p className="text-xs leading-relaxed text-white/80">
                EvntSC is an independent student-built prototype. It is not affiliated with or endorsed by USC, does not verify officer identity, and
                cannot approve events or guarantee funding. Always confirm with the linked offices.
              </p>
            </div>
          </footer>
          {user && <BottomNav discover={discover} />}
        </ConfirmProvider>
      </body>
    </html>
  );
}
