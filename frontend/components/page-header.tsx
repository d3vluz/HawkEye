import { Fragment, type ReactNode } from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"

export interface Crumb {
  label: string
  href?: string
}

export function PageHeader({ crumbs, title, description, actions }: {
  crumbs: Crumb[]
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <nav aria-label="Trilha de navegação" className="mb-3 flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {crumbs.map((crumb, i) => {
            const last = i === crumbs.length - 1
            return (
              <Fragment key={`${crumb.label}-${i}`}>
                {i > 0 && <ChevronRight className="size-3" aria-hidden />}
                {last ? (
                  <span aria-current="page" className="max-w-[40ch] truncate text-foreground">{crumb.label}</span>
                ) : crumb.href ? (
                  <Link href={crumb.href} className="transition-colors hover:text-foreground">{crumb.label}</Link>
                ) : (
                  <span>{crumb.label}</span>
                )}
              </Fragment>
            )
          })}
        </nav>
        <h1 className="truncate text-3xl font-bold text-foreground">{title}</h1>
        {description && <div className="mt-2 text-sm text-muted-foreground">{description}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-col items-end gap-1">{actions}</div>}
    </header>
  )
}
