import type { ReactNode } from "react"

export function SettingsPanel({ title, description, action, footer, children }: {
  title: string
  description: string
  action?: ReactNode
  footer?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex flex-col gap-3 border-b border-border p-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-prose">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="mt-1 text-sm text-pretty text-muted-foreground">{description}</p>
        </div>
        {action}
      </header>
      <div className="p-6">{children}</div>
      {footer && <footer className="flex flex-col gap-3 border-t border-border px-6 py-4 sm:flex-row sm:items-center sm:justify-between">{footer}</footer>}
    </section>
  )
}

export function PanelState({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "danger" }) {
  return (
    <p role={tone === "danger" ? "alert" : undefined} className={tone === "danger" ? "text-sm text-danger-emphasis" : "text-sm text-muted-foreground"}>
      {children}
    </p>
  )
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ["KB", "MB", "GB", "TB"]
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${units[unit]}`
}
