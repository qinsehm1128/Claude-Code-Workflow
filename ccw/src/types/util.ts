// ========================================
// Utility Types
// ========================================
// Common utility type definitions

/**
 * Deep partial type - makes all nested properties optional
 */
export type DeepPartial<T> = T extends object
  ? {
      [P in keyof T]?: DeepPartial<T[P]>;
    }
  : T;

/**
 * Make specific keys optional
 */
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Make specific keys required
 */
export type RequiredBy<T, K extends keyof T> = Omit<T, K> & Required<Pick<T, K>>;

/**
 * Extract function parameter types
 */
export type Parameters<T> = T extends (...args: infer P) => unknown ? P : never;

/**
 * Extract function return type
 */
export type ReturnType<T> = T extends (...args: unknown[]) => infer R ? R : never;

// ========================================
// Utility Functions
// ========================================

/**
 * Deep merge utility for configuration updates
 * Recursively merges source into target, preserving nested objects
 */
export function deepMerge<T extends object>(
  target: T,
  source: DeepPartial<T>
): T {
  const result = { ...target } as T;

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key as keyof typeof source];
      const targetValue = target[key as unknown as keyof T];

      if (
        sourceValue !== undefined &&
        sourceValue !== null &&
        typeof sourceValue === 'object' &&
        !Array.isArray(sourceValue) &&
        targetValue !== undefined &&
        targetValue !== null &&
        typeof targetValue === 'object' &&
        !Array.isArray(targetValue)
      ) {
        (result as Record<string, unknown>)[key] = deepMerge(
          targetValue as object,
          sourceValue as DeepPartial<object>
        );
      } else if (sourceValue !== undefined) {
        (result as Record<string, unknown>)[key] = sourceValue;
      }
    }
  }

  return result;
}
