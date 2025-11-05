import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/** Une clases condicionales y resuelve conflictos de Tailwind (variant + className) */
export function cn(...inputs: any[]) {
  return twMerge(clsx(inputs))
}

