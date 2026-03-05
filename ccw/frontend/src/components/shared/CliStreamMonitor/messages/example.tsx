// ========================================
// Message Components Usage Example
// ========================================
// This file demonstrates how to use the message components

import {
  SystemMessage,
  UserMessage,
  AssistantMessage,
  ErrorMessage
} from './index';

export function MessageExample() {
  return (
    <div className="space-y-3 p-4">
      {/* System Message Example */}
      <SystemMessage
        title="Session Started"
        timestamp={Date.now()}
        metadata="Context: 28 files"
        content="CLI execution started: gemini (analysis mode)"
      />

      {/* User Message Example */}
      <UserMessage
        timestamp={Date.now()}
        content={`PURPOSE: Review LogBlock component architecture
TASK: • Analyze component structure • Identify patterns • Check performance
MODE: analysis
CONTEXT: @src/components/shared/LogBlock/**/*`}
        onCopy={() => console.log('Copied user message')}
        onViewRaw={() => console.log('View raw JSON')}
      />

      {/* Assistant Message Example - Thinking */}
      <AssistantMessage
        modelName="Gemini"
        status="thinking"
        content="Analyzing the LogBlock component structure..."
        timestamp={Date.now()}
      />

      {/* Assistant Message Example - Completed */}
      <AssistantMessage
        modelName="Gemini"
        status="completed"
        duration={4800}
        tokenCount={10510}
        timestamp={Date.now()}
        content={`I've analyzed the LogBlock component.

**Key Findings:**
- Component uses React.memo for performance optimization
- Status-based border colors provide visual feedback
- Collapsible content area with chevron indicator
- Action buttons appear on group hover

**Architecture:**
- Header: Expandable with status icon, title, metadata
- Content: Monospace font output with line icons
- Actions: Copy command/output, re-run buttons`}
        onCopy={() => console.log('Copied assistant message')}
      />

      {/* Error Message Example */}
      <ErrorMessage
        title="Error"
        message="Failed to fetch active CLI executions\n\nStatus: 500 Internal Server Error\nDetails: Connection timeout after 30s"
        timestamp={Date.now()}
        onRetry={() => console.log('Retrying...')}
        onDismiss={() => console.log('Dismissed')}
      />
    </div>
  );
}

// Props Interface Reference
/*
SystemMessageProps:
  - title: string
  - timestamp?: number
  - metadata?: string
  - content?: string
  - className?: string

UserMessageProps:
  - content: string
  - timestamp?: number
  - onCopy?: () => void
  - onViewRaw?: () => void
  - className?: string

AssistantMessageProps:
  - content: string
  - modelName?: string
  - status?: 'thinking' | 'streaming' | 'completed' | 'error'
  - duration?: number
  - tokenCount?: number
  - timestamp?: number
  - onCopy?: () => void
  - className?: string

ErrorMessageProps:
  - title: string
  - message: string
  - timestamp?: number
  - onRetry?: () => void
  - onDismiss?: () => void
  - className?: string
*/
