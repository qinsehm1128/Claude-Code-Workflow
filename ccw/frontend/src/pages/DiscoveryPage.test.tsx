// ========================================
// Discovery Page Tests
// ========================================
// Tests for the issue discovery page with i18n

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@/test/i18n';
import { DiscoveryPage } from './DiscoveryPage';
import { useWorkflowStore } from '@/stores/workflowStore';
import type { DiscoverySession } from '@/lib/api';

// Mock sessions data
const mockSessions: DiscoverySession[] = [
  {
    id: '1',
    name: 'Session 1',
    status: 'running',
    progress: 50,
    findings_count: 5,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Session 2',
    status: 'completed',
    progress: 100,
    findings_count: 10,
    created_at: '2024-01-02T00:00:00Z',
  },
];

// Mock hooks at top level
vi.mock('@/hooks/useIssues', () => ({
  useIssueDiscovery: () => ({
    sessions: mockSessions,
    activeSession: null,
    findings: [],
    filteredFindings: [],
    isLoadingSessions: false,
    isLoadingFindings: false,
    error: null,
    filters: {},
    setFilters: vi.fn(),
    selectSession: vi.fn(),
    refetchSessions: vi.fn(),
    exportFindings: vi.fn(),
  }),
}));

describe('DiscoveryPage', () => {
  beforeEach(() => {
    useWorkflowStore.setState({ projectPath: '/test/path' });
    vi.clearAllMocks();
  });

  describe('with en locale', () => {
    it('should render page title', () => {
      render(<DiscoveryPage />, { locale: 'en' });
      expect(screen.getAllByText(/Issue Discovery/i).length).toBeGreaterThan(0);
    });

    it('should render page description', () => {
      render(<DiscoveryPage />, { locale: 'en' });
      expect(screen.getByText(/View and manage issue discovery sessions/i)).toBeInTheDocument();
    });

    it('should render stats cards', () => {
      render(<DiscoveryPage />, { locale: 'en' });
      expect(screen.getAllByText(/Total Sessions/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Completed/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Running/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Total Findings/i).length).toBeGreaterThan(0);
    });

    it('should render session list heading', () => {
      render(<DiscoveryPage />, { locale: 'en' });
      expect(screen.getAllByText(/Sessions/i).length).toBeGreaterThan(0);
    });

    it('should render findings detail heading', () => {
      render(<DiscoveryPage />, { locale: 'en' });
      expect(screen.getByText(/Findings Detail/i)).toBeInTheDocument();
    });

    it('should display session count in stats', () => {
      render(<DiscoveryPage />, { locale: 'en' });
      expect(screen.getByText('2')).toBeInTheDocument(); // Total sessions
    });
  });

  describe('with zh locale', () => {
    it('should render translated title', () => {
      render(<DiscoveryPage />, { locale: 'zh' });
      expect(screen.getAllByText(/问题发现/i).length).toBeGreaterThan(0);
    });

    it('should render translated description', () => {
      render(<DiscoveryPage />, { locale: 'zh' });
      expect(screen.getByText(/查看和管理问题发现会话/i)).toBeInTheDocument();
    });

    it('should render translated stats', () => {
      render(<DiscoveryPage />, { locale: 'zh' });
      expect(screen.getAllByText(/总会话数/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/已完成/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/运行中/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/总发现数/i).length).toBeGreaterThan(0);
    });

    it('should render translated session list heading', () => {
      render(<DiscoveryPage />, { locale: 'zh' });
      expect(screen.getAllByText(/会话/i).length).toBeGreaterThan(0);
    });

    it('should render translated findings detail heading', () => {
      render(<DiscoveryPage />, { locale: 'zh' });
      expect(screen.getByText(/发现详情/i)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper heading structure', () => {
      render(<DiscoveryPage />, { locale: 'en' });
      const heading = screen.getByRole('heading', { level: 1, name: /Issue Discovery/i });
      expect(heading).toBeInTheDocument();
    });

    it('should have proper semantic structure', () => {
      render(<DiscoveryPage />, { locale: 'en' });
      // Check for sub-headings
      const subHeadings = screen.getAllByRole('heading', { level: 2 });
      expect(subHeadings.length).toBeGreaterThanOrEqual(2);
    });
  });
});
