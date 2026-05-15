import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function Panel({
  title,
  description,
  icon: Icon,
  aside,
  children,
  className = "",
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-zinc-800 bg-zinc-950/85 shadow-panel ${className}`}>
      <div className="flex flex-col gap-3 border-b border-zinc-800 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span className="mt-0.5 rounded-md border border-zinc-700 bg-zinc-900 p-2 text-zinc-400">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
          ) : null}
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-50">{title}</h2>
            {description ? <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p> : null}
          </div>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}
