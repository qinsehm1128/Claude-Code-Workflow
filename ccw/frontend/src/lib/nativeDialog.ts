// ========================================
// Native OS Dialog Helpers
// ========================================
// Calls server-side endpoints that open system-native file/folder picker dialogs.
// Returns structured DialogResult objects for clear success/cancel/error handling.

/**
 * Represents the result of a native dialog operation.
 */
export interface DialogResult {
  /** The selected path. Null if cancelled or an error occurred. */
  path: string | null;
  /** True if the user cancelled the dialog. */
  cancelled: boolean;
  /** An error message if the operation failed. */
  error?: string;
}

/**
 * Opens a native OS folder selection dialog.
 * 
 * @param initialDir - Optional directory to start the dialog in
 * @returns DialogResult with path, cancelled status, and optional error
 * 
 * @example
 * ```typescript
 * const result = await selectFolder('/home/user/projects');
 * if (result.path) {
 *   console.log('Selected:', result.path);
 * } else if (result.cancelled) {
 *   console.log('User cancelled');
 * } else if (result.error) {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export async function selectFolder(initialDir?: string): Promise<DialogResult> {
  try {
    const res = await fetch('/api/dialog/select-folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialDir }),
    });

    if (!res.ok) {
      return {
        path: null,
        cancelled: false,
        error: `Server responded with status: ${res.status}`,
      };
    }

    const data = await res.json();
    if (data.cancelled) {
      return { path: null, cancelled: true };
    }

    return { path: data.path || null, cancelled: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred';
    return { path: null, cancelled: false, error: message };
  }
}

/**
 * Opens a native OS file selection dialog.
 * 
 * @param initialDir - Optional directory to start the dialog in
 * @returns DialogResult with path, cancelled status, and optional error
 * 
 * @example
 * ```typescript
 * const result = await selectFile('/home/user/documents');
 * if (result.path) {
 *   console.log('Selected:', result.path);
 * } else if (result.cancelled) {
 *   console.log('User cancelled');
 * } else if (result.error) {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export async function selectFile(initialDir?: string): Promise<DialogResult> {
  try {
    const res = await fetch('/api/dialog/select-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initialDir }),
    });

    if (!res.ok) {
      return {
        path: null,
        cancelled: false,
        error: `Server responded with status: ${res.status}`,
      };
    }

    const data = await res.json();
    if (data.cancelled) {
      return { path: null, cancelled: true };
    }

    return { path: data.path || null, cancelled: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred';
    return { path: null, cancelled: false, error: message };
  }
}
