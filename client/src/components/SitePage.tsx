import { Button } from "@/components/ui/button";
import { ArrowLeft, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "wouter";

type SitePageProps = {
  title: string;
  description?: string;
  badge?: string;
  icon?: LucideIcon;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export function SitePage({
  title,
  description,
  badge,
  icon: Icon,
  backHref = "/",
  backLabel = "Voltar",
  actions,
  children,
}: SitePageProps) {
  return (
    <div className="safe-shell min-h-screen bg-background text-foreground pb-20">
      <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/65 backdrop-blur-xl">
        <div className="container py-4 md:py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-4">
              <Button asChild variant="outline" className="mt-1 gap-2 rounded-full border-white/15 bg-white/5">
                <Link href={backHref}>
                  <ArrowLeft className="h-4 w-4" />
                  <span>{backLabel}</span>
                </Link>
              </Button>
              <div className="min-w-0 space-y-2">
                {badge ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-cyan-100">
                    {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                    {badge}
                  </div>
                ) : null}
                <div>
                  <h1 className="text-2xl font-semibold text-white md:text-3xl">{title}</h1>
                  {description ? (
                    <p className="mt-2 max-w-3xl text-sm text-white/65 md:text-base">{description}</p>
                  ) : null}
                </div>
              </div>
            </div>
            {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
          </div>
        </div>
      </div>

      <div className="container py-6 md:py-8">{children}</div>
    </div>
  );
}

export function SiteSection({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="glass-panel overflow-hidden">
      {(title || description || actions) ? (
        <div className="flex flex-col gap-3 border-b border-white/10 p-5 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            {title ? <h2 className="text-xl font-semibold text-white">{title}</h2> : null}
            {description ? <p className="text-sm text-white/65">{description}</p> : null}
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}
