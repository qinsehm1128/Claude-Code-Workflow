// ========================================
// Chunk Error Boundary
// ========================================
// Error boundary for handling lazy-loaded chunk load failures
// Catches network failures, missing chunks, and other module loading errors

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/Button';

interface ChunkErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ChunkErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error displayed when a chunk fails to load
 */
function ChunkLoadError({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const handleGoBack = () => {
    // Try to go back in history, fallback to home if no history
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.href = '/';
    }
  };

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="text-center max-w-md">
        <div className="mb-4">
          <svg
            className="w-16 h-16 mx-auto text-destructive"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <h2 className="text-xl font-semibold mb-2">Failed to Load Page</h2>
        <p className="text-muted-foreground mb-6">
          {error?.message.includes('ChunkLoadError')
            ? 'A network error occurred while loading this page. Please check your connection and try again.'
            : 'An error occurred while loading this page. Please try refreshing.'}
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <Button onClick={onRetry} variant="default">
            Try Again
          </Button>
          <Button onClick={handleGoBack} variant="outline">
            Go Back
          </Button>
          <Button onClick={() => window.location.href = '/'} variant="ghost">
            Go Home
          </Button>
        </div>
        {error && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
              Technical details
            </summary>
            <pre className="mt-2 text-xs bg-muted p-2 rounded overflow-auto max-h-32">
              {error.toString()}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/**
 * Error boundary class component for catching chunk load errors
 *
 * Wraps lazy-loaded route components to gracefully handle:
 * - Network failures during chunk fetch
 * - Missing or outdated chunk files
 * - Browser caching issues
 */
export class ChunkErrorBoundary extends Component<ChunkErrorBoundaryProps, ChunkErrorBoundaryState> {
  constructor(props: ChunkErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ChunkErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error for debugging
    console.error('[ChunkErrorBoundary] Chunk load error:', error, errorInfo);

    this.setState({
      errorInfo,
    });

    // Optionally send error to monitoring service
    if (typeof window !== 'undefined' && (window as any).reportError) {
      (window as any).reportError(error);
    }
  }

  handleRetry = (): void => {
    // Reset error state and retry
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Force reload the current route to retry chunk loading
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return <ChunkLoadError error={this.state.error} onRetry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

/**
 * HOC to wrap a component with ChunkErrorBoundary
 *
 * Usage:
 * ```tsx
 * const SafePage = withChunkErrorBoundary(MyPage);
 * ```
 */
export function withChunkErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
): React.ComponentType<P> {
  return function WrappedComponent(props: P) {
    return (
      <ChunkErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ChunkErrorBoundary>
    );
  };
}
