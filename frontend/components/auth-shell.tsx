"use client"

import { useEffect, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react"
import { Eye, EyeOff, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const GRID_COLUMNS = 6
const GRID_ROWS = 8
const LOGO_CELLS = new Set([20, 21, 26, 27])
const FIELD_CLASS = "h-10 border-[var(--graphite-600)] bg-card shadow-none"
export const FORM_ERROR_ID = "form-error"

// Máscara em vez de <Image>: a mesma arte assume a cor do token nos dois temas.
function LogoMark({ className, label }: { className?: string; label?: string }) {
  const mask = "url(/logo.png) center / contain no-repeat"
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn("block", className)}
      style={{ mask, WebkitMask: mask }}
    />
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="size-9" />
  const isDark = resolvedTheme === "dark"

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={isDark ? "Usar tema claro" : "Usar tema escuro"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="text-muted-foreground hover:text-foreground"
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  )
}

function InspectionGrid() {
  const cells = Array.from({ length: GRID_COLUMNS * GRID_ROWS }, (_, index) => index)

  return (
    <aside className="hidden min-h-dvh flex-col bg-sidebar text-sidebar-foreground lg:flex">
      <div aria-hidden className="relative grid flex-1 grid-cols-6 grid-rows-8 overflow-hidden">
        {cells.filter((index) => !LOGO_CELLS.has(index)).map((index) => (
          <div
            key={index}
            className={cn(
              "inspection-cell flex items-center justify-center border-b border-[var(--graphite-600)]",
              index % GRID_COLUMNS !== GRID_COLUMNS - 1 && "border-r"
            )}
            style={{ "--column": index % GRID_COLUMNS } as CSSProperties}
          >
            <span
              className="h-[34%] w-2 rounded-sm bg-sidebar-foreground/20"
              style={{ transform: `rotate(${((index * 37) % 13) - 6}deg)` }}
            />
          </div>
        ))}
        <div className="col-span-2 col-start-3 row-span-2 row-start-4 flex items-center justify-center border-r border-b border-[var(--graphite-600)] bg-sidebar p-6">
          <LogoMark className="size-full bg-sidebar-foreground" />
        </div>
        <span className="inspection-sweep pointer-events-none absolute inset-0 border-l-2 border-signal" />
      </div>
      <div className="flex items-center justify-between gap-6 px-8 py-5 text-sm">
        <span className="text-sidebar-foreground">Inspeção visual de componentes eletrônicos</span>
        <span className="whitespace-nowrap text-sidebar-foreground/70">Áreas · Pinos · Caixas · Hastes</span>
      </div>
    </aside>
  )
}

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <main className="flex min-w-0 flex-col px-6 py-5 sm:px-10">
        <div className="mx-auto flex w-full max-w-sm items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-9 bg-foreground" />
            <span className="text-lg font-semibold text-foreground">HawkEye</span>
          </div>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <h1 className="text-3xl leading-tight font-bold tracking-[-0.01em] text-balance text-foreground">{title}</h1>
            <p className="mt-2 mb-8 text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
            {children}
          </div>
        </div>
      </main>
      <InspectionGrid />
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return <p id={FORM_ERROR_ID} role="alert" className="text-sm text-danger-emphasis">{message}</p>
}

export function TextField({ id, label, invalid, ...props }: ComponentProps<typeof Input> & { id: string; label: string; invalid?: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="font-semibold text-foreground">{label}</Label>
      <Input id={id} className={FIELD_CLASS} aria-invalid={invalid || undefined} aria-describedby={invalid ? FORM_ERROR_ID : undefined} {...props} />
    </div>
  )
}

export function PasswordField({ id, label, hint, invalid, ...props }: ComponentProps<typeof Input> & { id: string; label: string; hint?: string; invalid?: boolean }) {
  const [visible, setVisible] = useState(false)
  const describedBy = [hint && `${id}-hint`, invalid && FORM_ERROR_ID].filter(Boolean).join(" ")

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="font-semibold text-foreground">{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          className={cn(FIELD_CLASS, "pr-11")}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy || undefined}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
          className="absolute top-0.5 right-0.5 text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
