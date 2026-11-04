import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function DashboardPanel({ title, description, action, className, children }: {
  title: string
  description?: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  return (
    <section className={cn("flex flex-col rounded-xl border border-border bg-card", className)}>
      <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action}
      </header>
      <div className="flex flex-1 flex-col p-5">{children}</div>
    </section>
  )
}

export function PanelEmpty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center py-10 text-center">
      {icon}
      <p className="mt-3 text-sm font-medium text-foreground">{title}</p>
      {children && <p className="mt-1 max-w-xs text-xs text-pretty text-muted-foreground">{children}</p>}
    </div>
  )
}
