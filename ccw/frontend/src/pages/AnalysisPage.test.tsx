// ========================================
// Analysis Page Tests
// ========================================
// Tests for the Analysis Viewer page

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AnalysisPage } from './AnalysisPage';
import { useWorkflowStore } from '@/stores/workflowStore';
import type { AnalysisSessionSummary } from '@/types/analysis';

// Mock sessions data
const mockSessions: AnalysisSessionSummary[] = [
  {
    id: 'ANL-test-session-2026-01-01',
    name: 'test-session',
    topic: 'Test Analysis Topic',
    createdAt: '2026-01-01',
    status: 'completed',
    hasConclusions: true,
  },
  {
    id: 'ANL-another-session-2026-01-02',
    name: 'another-session',
    topic: 'Another Analysis',
    createdAt: '2026-01-02',
    status: 'in_progress',
    hasConclusions: false,
  },
];

// Mock API
vi.mock('@/lib/api', () => ({
  fetchAnalysisSessions: vi.fn(() => Promise.resolve(mockSessions)),
  fetchAnalysisDetail: vi.fn(() => Promise.resolve({
    id: 'ANL-test-session-2026-01-01',
    name: 'test-session',
    topic: 'Test Analysis Topic',
    createdAt: '2026-01-01',
    status: 'completed',
    discussion: 'Test discussion content',
    conclusions: null,
    explorations: null,
    perspectives: null,
  })),
}));

// Create a wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('AnalysisPage', () => {
  beforeEach(() => {
    useWorkflowStore.setState({ projectPath: '/test/path' });
    vi.clearAllMocks();
  });

  it('should render page title', async () => {
    render(<AnalysisPage />, { wrapper: createWrapper() });
    expect(screen.getByText('Analysis Viewer')).toBeInTheDocument();
  });

  it('should render page description', async () => {
    render(<AnalysisPage />, { wrapper: createWrapper() });
    expect(screen.getByText(/查看.*analyze-with-file.*分析结果/)).toBeInTheDocument();
  });

  it('should render search input', async () => {
    render(<AnalysisPage />, { wrapper: createWrapper() });
    expect(screen.getByPlaceholderText('搜索分析会话...')).toBeInTheDocument();
  });

  it('should show loading state initially', () => {
    render(<AnalysisPage />, { wrapper: createWrapper() });
    // Loading spinner should be present initially
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('should render session cards after loading', async () => {
    render(<AnalysisPage />, { wrapper: createWrapper() });

    // Wait for sessions to load
    const sessionTopic = await screen.findByText('Test Analysis Topic');
    expect(sessionTopic).toBeInTheDocument();

    const anotherSession = await screen.findByText('Another Analysis');
    expect(anotherSession).toBeInTheDocument();
  });

  it('should show completed badge for completed sessions', async () => {
    render(<AnalysisPage />, { wrapper: createWrapper() });

    // Wait for sessions to load
    await screen.findByText('Test Analysis Topic');

    // Check for completed badge
    expect(screen.getByText('完成')).toBeInTheDocument();
  });

  it('should show in-progress badge for running sessions', async () => {
    render(<AnalysisPage />, { wrapper: createWrapper() });

    // Wait for sessions to load
    await screen.findByText('Another Analysis');

    // Check for in-progress badge
    expect(screen.getByText('进行中')).toBeInTheDocument();
  });
});
