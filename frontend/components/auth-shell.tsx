"use client"

import { useEffect, useState, type ComponentProps, type CSSProperties, type KeyboardEvent, type ReactNode } from "react"
import { Eye, EyeOff, Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"

const FIELD_CLASS = "h-11 border-[var(--graphite-600)] bg-card shadow-none"
export const FORM_ERROR_ID = "form-error"

const COLS = 5
const ROWS = 3
const CELL_W = 80
const CELL_H = 72
const ORIGIN_X = 40
const ORIGIN_Y = 44
const PIN_COLOR = "#F2B705"
const ODD_PIN_COLOR = "#8FA3BF"
const PIN_ANGLES = [-18, 4, 90, -40, 20, -22, 62, 58, 0, 80, 8, -60, 38, 12, 52]

type Finding = { label: string; kind: "missing" | "wrong-color" }
const FINDINGS: Record<string, Finding> = {
  "0-2": { label: "Pino ausente", kind: "missing" },
  "2-3": { label: "Cor incorreta", kind: "wrong-color" },
}

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

function Pushpin({ x, y, angle, color }: { x: number; y: number; angle: number; color: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle}) scale(0.82)`}>
      <line x1={8} x2={34} y1={0} y2={0} stroke="var(--graphite-200)" strokeWidth={1.4} strokeLinecap="round" />
      <rect x={-22} y={-5} width={26} height={10} rx={3} fill={color} />
      <rect x={-27} y={-11} width={7} height={22} rx={3} fill={color} />
      <rect x={2} y={-9} width={6} height={18} rx={3} fill={color} />
    </g>
  )
}

function Corner({ x, y, dx, dy }: { x: number; y: number; dx: number; dy: number }) {
  return <path d={`M${x} ${y + dy * 14}V${y}H${x + dx * 14}`} fill="none" stroke="var(--graphite-300)" strokeWidth={1.5} />
}

// Ilustração do resultado de uma inspeção: cada caixa aparece quando a varredura passa pela coluna.
function InspectionViewport() {
  const cells = Array.from({ length: COLS * ROWS }, (_, i) => ({ row: Math.floor(i / COLS), col: i % COLS }))
  const width = ORIGIN_X * 2 + COLS * CELL_W
  const height = ORIGIN_Y * 2 + ROWS * CELL_H

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--graphite-700)] bg-[var(--graphite-900)]">
      <div className="flex items-center justify-between border-b border-[var(--graphite-700)] px-4 py-2.5 text-xs">
        <span className="font-medium text-[var(--graphite-50)]">Caixa de percevejos · captura 07</span>
        <span className="flex items-center gap-1.5 text-[var(--graphite-200)]">
          <span className="size-1.5 rounded-full bg-[var(--signal)]" />
          Processado
        </span>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="block w-full" aria-hidden>
        <defs>
          <pattern id="auth-dots" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--graphite-700)" />
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#auth-dots)" />
        <Corner x={12} y={12} dx={1} dy={1} />
        <Corner x={width - 12} y={12} dx={-1} dy={1} />
        <Corner x={12} y={height - 12} dx={1} dy={-1} />
        <Corner x={width - 12} y={height - 12} dx={-1} dy={-1} />

        <rect
          x={ORIGIN_X - 10}
          y={ORIGIN_Y - 10}
          width={COLS * CELL_W + 20}
          height={ROWS * CELL_H + 20}
          rx={12}
          fill="var(--graphite-900)"
          stroke="var(--graphite-300)"
          strokeWidth={3}
        />

        {cells.map(({ row, col }) => {
          const x = ORIGIN_X + col * CELL_W
          const y = ORIGIN_Y + row * CELL_H
          const cx = x + CELL_W / 2
          const finding = FINDINGS[`${row}-${col}`]
          const tone = finding ? "var(--state-danger)" : "var(--signal)"
          return (
            <g key={`${row}-${col}`}>
              <rect x={x} y={y} width={CELL_W} height={CELL_H} fill="none" stroke="var(--graphite-600)" strokeWidth={3} />
              {finding?.kind !== "missing" && (
                <Pushpin
                  x={cx}
                  y={y + CELL_H / 2}
                  angle={PIN_ANGLES[row * COLS + col]}
                  color={finding?.kind === "wrong-color" ? ODD_PIN_COLOR : PIN_COLOR}
                />
              )}
              <rect
                className="auth-detection"
                style={{ "--column": col } as CSSProperties}
                x={x + 8}
                y={y + 8}
                width={CELL_W - 16}
                height={CELL_H - 16}
                rx={3}
                fill={finding ? "color-mix(in oklab, var(--state-danger) 16%, transparent)" : "none"}
                stroke={tone}
                strokeWidth={finding ? 1.75 : 1}
                strokeOpacity={finding ? 1 : 0.7}
                strokeDasharray={finding?.kind === "missing" ? "4 3" : undefined}
              />
            </g>
          )
        })}

        {Object.entries(FINDINGS).map(([key, finding]) => {
          const [row, col] = key.split("-").map(Number)
          const x = ORIGIN_X + col * CELL_W + 8
          const above = row === 0
          const y = above ? ORIGIN_Y - 32 : ORIGIN_Y + ROWS * CELL_H + 14
          const w = finding.label.length * 6.4 + 16
          return (
            <g key={key} className="auth-detection" style={{ "--column": col } as CSSProperties}>
              <line
                x1={x + 8}
                x2={x + 8}
                y1={above ? y + 18 : ORIGIN_Y + (row + 1) * CELL_H - 8}
                y2={above ? ORIGIN_Y + row * CELL_H + 8 : y}
                stroke="var(--state-danger)"
              />
              <rect x={x} y={y} width={w} height={18} rx={4} fill="var(--state-danger)" />
              <text x={x + 8} y={y + 12.5} fontSize={11} fontWeight={600} fill="var(--graphite-900)">
                {finding.label}
              </text>
            </g>
          )
        })}

        <line className="auth-sweep" x1={ORIGIN_X - 10} x2={ORIGIN_X - 10} y1={ORIGIN_Y - 16} y2={ORIGIN_Y + ROWS * CELL_H + 16} stroke="var(--signal)" strokeWidth={2} />
      </svg>

      <dl className="grid grid-cols-3 divide-x divide-[var(--graphite-700)] border-t border-[var(--graphite-700)] text-xs">
        {[
          { label: "Compartimentos", value: "15 / 15", tone: "text-[var(--graphite-50)]" },
          { label: "Pinos conformes", value: "13 / 15", tone: "text-[var(--graphite-50)]" },
          { label: "Veredito", value: "Reprovado", tone: "text-[var(--danger-emphasis)]" },
        ].map((item) => (
          <div key={item.label} className="px-4 py-3">
            <dt className="text-[var(--graphite-200)]">{item.label}</dt>
            <dd className={cn("mt-0.5 text-sm font-semibold tabular-nums", item.tone)}>{item.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function Showcase() {
  return (
    <aside className="dark relative hidden min-h-dvh flex-col justify-between overflow-hidden bg-[var(--graphite-900)] px-12 py-10 text-[var(--graphite-50)] lg:flex xl:px-16">
      <div className="flex items-center gap-2 text-sm text-[var(--graphite-200)]">
        <span className="size-1.5 rounded-full bg-[var(--state-success)]" />
        Inspeção de qualidade por visão computacional
      </div>

      <div className="mx-auto w-full max-w-xl py-10">
        <h2 className="text-3xl leading-[1.15] font-bold tracking-[-0.015em] text-balance xl:text-4xl">
          Cada componente medido. Cada defeito registrado.
        </h2>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-pretty text-[var(--graphite-200)]">
          O HawkEye confere cada compartimento, pino e haste a cada captura e entrega um veredito objetivo para a revisão da linha.
        </p>
        <div className="mt-10">
          <InspectionViewport />
        </div>
      </div>

      <ul className="grid grid-cols-3 gap-6 border-t border-[var(--graphite-700)] pt-6 text-sm">
        {[
          ["Pinos", "Ausentes, danificados ou com cor errada"],
          ["Estrutura", "Grade, compartimentos e eixos"],
          ["Rastreio", "Cada lote ligado à linha e ao operador"],
        ].map(([title, text]) => (
          <li key={title}>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 leading-snug text-[var(--graphite-200)]">{text}</p>
          </li>
        ))}
      </ul>
    </aside>
  )
}

export function AuthShell({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(420px,5fr)_minmax(0,7fr)]">
      <main className="flex min-w-0 flex-col px-6 py-6 sm:px-10 lg:border-r lg:border-border">
        <div className="mx-auto flex w-full max-w-[380px] items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-8 bg-foreground" />
            <span className="text-base font-semibold tracking-tight text-foreground">HawkEye</span>
          </div>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[380px]">
            <h1 className="text-[1.75rem] leading-tight font-bold tracking-[-0.015em] text-balance text-foreground">{title}</h1>
            <p className="mt-2 mb-8 text-sm leading-relaxed text-pretty text-muted-foreground">{description}</p>
            {children}
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-[380px] flex-wrap items-center justify-between gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} HawkEye</span>
          <span>Acesso restrito a usuários autorizados</span>
        </div>
      </main>
      <Showcase />
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p
      id={FORM_ERROR_ID}
      role="alert"
      className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger-emphasis"
    >
      {message}
    </p>
  )
}

export function TextField({ id, label, invalid, ...props }: ComponentProps<typeof Input> & { id: string; label: string; invalid?: boolean }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="font-medium text-foreground">{label}</Label>
      <Input id={id} className={FIELD_CLASS} aria-invalid={invalid || undefined} aria-describedby={invalid ? FORM_ERROR_ID : undefined} {...props} />
    </div>
  )
}

export function PasswordField({
  id, label, hint, invalid, action, onKeyUp, onKeyDown, ...props
}: ComponentProps<typeof Input> & { id: string; label: string; hint?: string; invalid?: boolean; action?: ReactNode }) {
  const [visible, setVisible] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const describedBy = [hint && `${id}-hint`, capsLock && `${id}-caps`, invalid && FORM_ERROR_ID].filter(Boolean).join(" ")

  const trackCapsLock = (event: KeyboardEvent<HTMLInputElement>) => setCapsLock(event.getModifierState("CapsLock"))

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <Label htmlFor={id} className="font-medium text-foreground">{label}</Label>
        {action}
      </div>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          className={cn(FIELD_CLASS, "pr-11")}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy || undefined}
          onKeyDown={(event) => { trackCapsLock(event); onKeyDown?.(event) }}
          onKeyUp={(event) => { trackCapsLock(event); onKeyUp?.(event) }}
          onBlur={() => setCapsLock(false)}
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          onClick={() => setVisible((value) => !value)}
          className="absolute top-1 right-1 text-muted-foreground hover:text-foreground"
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
      {capsLock && <p id={`${id}-caps`} className="text-xs text-warning-emphasis">Caps Lock está ativado.</p>}
      {hint && <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}
