// Painel à direita das telas de acesso: ilustração de uma inspeção, com varredura animada e dois defeitos marcados.

import type { CSSProperties } from "react"
import { cn } from "@/lib/utils"

const COLUNAS = 5
const LINHAS = 3
const LARGURA_DA_CELULA = 80
const ALTURA_DA_CELULA = 72
const MARGEM_X = 40
const MARGEM_Y = 44
const COR_DO_PINO = "#F2B705"
const COR_ERRADA = "#8FA3BF"
const ANGULOS = [-18, 4, 90, -40, 20, -22, 62, 58, 0, 80, 8, -60, 38, 12, 52]

const ACHADOS: Record<string, { rotulo: string; tipo: "ausente" | "cor-errada" }> = {
  "0-2": { rotulo: "Pino ausente", tipo: "ausente" },
  "2-3": { rotulo: "Cor incorreta", tipo: "cor-errada" },
}

function Percevejo({ x, y, angulo, cor }: { x: number; y: number; angulo: number; cor: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angulo}) scale(0.82)`}>
      <line x1={8} x2={34} y1={0} y2={0} stroke="var(--graphite-200)" strokeWidth={1.4} strokeLinecap="round" />
      <rect x={-22} y={-5} width={26} height={10} rx={3} fill={cor} />
      <rect x={-27} y={-11} width={7} height={22} rx={3} fill={cor} />
      <rect x={2} y={-9} width={6} height={18} rx={3} fill={cor} />
    </g>
  )
}

function Canto({ x, y, dx, dy }: { x: number; y: number; dx: number; dy: number }) {
  return <path d={`M${x} ${y + dy * 14}V${y}H${x + dx * 14}`} fill="none" stroke="var(--graphite-300)" strokeWidth={1.5} />
}

// Cada marcação aparece quando a varredura passa pela coluna (atraso calculado no CSS por --column).
function CapturaIlustrada() {
  const celulas = Array.from({ length: COLUNAS * LINHAS }, (_, i) => ({ linha: Math.floor(i / COLUNAS), coluna: i % COLUNAS }))
  const largura = MARGEM_X * 2 + COLUNAS * LARGURA_DA_CELULA
  const altura = MARGEM_Y * 2 + LINHAS * ALTURA_DA_CELULA

  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--graphite-700)] bg-[var(--graphite-900)]">
      <div className="flex items-center justify-between border-b border-[var(--graphite-700)] px-4 py-2.5 text-xs">
        <span className="font-medium text-[var(--graphite-50)]">Caixa de percevejos · captura 07</span>
        <span className="flex items-center gap-1.5 text-[var(--graphite-200)]">
          <span className="size-1.5 rounded-full bg-[var(--signal)]" />
          Processado
        </span>
      </div>

      <svg viewBox={`0 0 ${largura} ${altura}`} className="block w-full" aria-hidden>
        <defs>
          <pattern id="pontos-do-fundo" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="var(--graphite-700)" />
          </pattern>
        </defs>
        <rect width={largura} height={altura} fill="url(#pontos-do-fundo)" />
        <Canto x={12} y={12} dx={1} dy={1} />
        <Canto x={largura - 12} y={12} dx={-1} dy={1} />
        <Canto x={12} y={altura - 12} dx={1} dy={-1} />
        <Canto x={largura - 12} y={altura - 12} dx={-1} dy={-1} />

        <rect
          x={MARGEM_X - 10}
          y={MARGEM_Y - 10}
          width={COLUNAS * LARGURA_DA_CELULA + 20}
          height={LINHAS * ALTURA_DA_CELULA + 20}
          rx={12}
          fill="var(--graphite-900)"
          stroke="var(--graphite-300)"
          strokeWidth={3}
        />

        {celulas.map(({ linha, coluna }) => {
          const x = MARGEM_X + coluna * LARGURA_DA_CELULA
          const y = MARGEM_Y + linha * ALTURA_DA_CELULA
          const achado = ACHADOS[`${linha}-${coluna}`]
          return (
            <g key={`${linha}-${coluna}`}>
              <rect x={x} y={y} width={LARGURA_DA_CELULA} height={ALTURA_DA_CELULA} fill="none" stroke="var(--graphite-600)" strokeWidth={3} />
              {achado?.tipo !== "ausente" && (
                <Percevejo
                  x={x + LARGURA_DA_CELULA / 2}
                  y={y + ALTURA_DA_CELULA / 2}
                  angulo={ANGULOS[linha * COLUNAS + coluna]}
                  cor={achado?.tipo === "cor-errada" ? COR_ERRADA : COR_DO_PINO}
                />
              )}
              <rect
                className="auth-detection"
                style={{ "--column": coluna } as CSSProperties}
                x={x + 8}
                y={y + 8}
                width={LARGURA_DA_CELULA - 16}
                height={ALTURA_DA_CELULA - 16}
                rx={3}
                fill={achado ? "color-mix(in oklab, var(--state-danger) 16%, transparent)" : "none"}
                stroke={achado ? "var(--state-danger)" : "var(--signal)"}
                strokeWidth={achado ? 1.75 : 1}
                strokeOpacity={achado ? 1 : 0.7}
                strokeDasharray={achado?.tipo === "ausente" ? "4 3" : undefined}
              />
            </g>
          )
        })}

        {Object.entries(ACHADOS).map(([chave, achado]) => {
          const [linha, coluna] = chave.split("-").map(Number)
          const x = MARGEM_X + coluna * LARGURA_DA_CELULA + 8
          const acima = linha === 0
          const y = acima ? MARGEM_Y - 32 : MARGEM_Y + LINHAS * ALTURA_DA_CELULA + 14
          return (
            <g key={chave} className="auth-detection" style={{ "--column": coluna } as CSSProperties}>
              <line
                x1={x + 8}
                x2={x + 8}
                y1={acima ? y + 18 : MARGEM_Y + (linha + 1) * ALTURA_DA_CELULA - 8}
                y2={acima ? MARGEM_Y + linha * ALTURA_DA_CELULA + 8 : y}
                stroke="var(--state-danger)"
              />
              <rect x={x} y={y} width={achado.rotulo.length * 6.4 + 16} height={18} rx={4} fill="var(--state-danger)" />
              <text x={x + 8} y={y + 12.5} fontSize={11} fontWeight={600} fill="var(--graphite-900)">{achado.rotulo}</text>
            </g>
          )
        })}

        <line className="auth-sweep" x1={MARGEM_X - 10} x2={MARGEM_X - 10} y1={MARGEM_Y - 16} y2={MARGEM_Y + LINHAS * ALTURA_DA_CELULA + 16} stroke="var(--signal)" strokeWidth={2} />
      </svg>

      <dl className="grid grid-cols-3 divide-x divide-[var(--graphite-700)] border-t border-[var(--graphite-700)] text-xs">
        {[
          { rotulo: "Compartimentos", valor: "15 / 15", cor: "text-[var(--graphite-50)]" },
          { rotulo: "Pinos conformes", valor: "13 / 15", cor: "text-[var(--graphite-50)]" },
          { rotulo: "Veredito", valor: "Reprovado", cor: "text-[var(--danger-emphasis)]" },
        ].map((item) => (
          <div key={item.rotulo} className="px-4 py-3">
            <dt className="text-[var(--graphite-200)]">{item.rotulo}</dt>
            <dd className={cn("mt-0.5 text-sm font-semibold tabular-nums", item.cor)}>{item.valor}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

export function Ilustracao() {
  return (
    <aside className="dark relative hidden min-h-dvh flex-col overflow-hidden bg-[var(--graphite-900)] px-12 py-10 text-[var(--graphite-50)] lg:flex xl:px-16">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center py-10">
        <h2 className="text-3xl leading-[1.15] font-bold tracking-[-0.015em] text-balance xl:text-4xl">
          Cada componente medido. Cada defeito registrado.
        </h2>
        <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-pretty text-[var(--graphite-200)]">
          O HawkEye confere cada compartimento, pino e haste a cada captura e entrega um veredito objetivo para a revisão da linha.
        </p>
        <div className="mt-10">
          <CapturaIlustrada />
        </div>
      </div>

      <ul className="grid grid-cols-3 gap-6 border-t border-[var(--graphite-700)] pt-6 text-sm">
        {[
          ["Pinos", "Ausentes, danificados ou com cor errada"],
          ["Estrutura", "Grade, compartimentos e eixos"],
          ["Rastreio", "Cada lote ligado à linha e ao operador"],
        ].map(([titulo, texto]) => (
          <li key={titulo}>
            <p className="font-semibold">{titulo}</p>
            <p className="mt-1 leading-snug text-[var(--graphite-200)]">{texto}</p>
          </li>
        ))}
      </ul>
    </aside>
  )
}
