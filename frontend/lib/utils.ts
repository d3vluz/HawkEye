import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function isToday(date: string | null | undefined): boolean {
  if (!date) return false
  const d = new Date(date)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

export function formatLastAccess(date: string | null | undefined): string {
  if (!date) return "Nunca"
  const d = new Date(date)
  const now = new Date()
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const diffDays = Math.round((startToday.getTime() - startDate.getTime()) / 86400000)
  if (diffDays <= 0) return "Hoje"
  if (diffDays === 1) return "Ontem"
  return `Há ${diffDays} dias`
}
