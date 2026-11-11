// Junta classes do Tailwind resolvendo conflitos (padrão do shadcn/ui).

import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
