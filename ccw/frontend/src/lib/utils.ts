import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges class names using clsx and tailwind-merge.
 * This utility combines Tailwind CSS classes intelligently,
 * handling conflicts and deduplication.
 *
 * @example
 * cn("px-2 py-1", "px-4") // => "py-1 px-4"
 * cn("bg-primary", condition && "bg-secondary") // conditional classes
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Safely parse memory metadata from string, object, or undefined.
 * Returns an empty object on parse failure or missing input.
 */
export function parseMemoryMetadata(
  metadata: string | Record<string, any> | undefined | null
): Record<string, any> {
  if (!metadata) return {};
  if (typeof metadata === 'object') return metadata;
  try {
    return JSON.parse(metadata);
  } catch {
    return {};
  }
}

export type { ClassValue };
