// ========================================
// Analysis Viewer Page
// ========================================
// View analysis sessions from /workflow:analyze-with-file command

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileSearch,
  Search,
  CheckCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  X,
  FileText,
  Code,
  MessageSquare,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useAppStore } from '@/stores/appStore';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { TabsNavigation } from '@/components/ui/TabsNavigation';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/Drawer';
import { fetchAnalysisSessions, fetchAnalysisDetail } from '@/lib/api';
import { MessageRenderer } from '@/components/shared/CliStreamMonitor/MessageRenderer';
import { JsonCardView } from '@/components/shared/JsonCardView';
import { cn } from '@/lib/utils';
import type { AnalysisSessionSummary } from '@/types/analysis';

const PAGE_SIZE = 16; // 4 rows × 4 columns

// ========== Session Card Component (Compact) ==========

interface SessionCardProps {
  session: AnalysisSessionSummary;
  onClick: () => void;
  onStatusClick: (status: string) => void;
  isStatusFiltered: boolean;
}

function SessionCard({ session, onClick, onStatusClick, isStatusFiltered }: SessionCardProps) {
  const handleStatusClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click
    onStatusClick(session.status);
  };

  return (
    <Card
      className="p-3 cursor-pointer transition-all hover:shadow-md hover:border-primary/50 h-full flex flex-col"
      onClick={onClick}
    >
      {/* Topic - smaller font */}
      <h3 className="text-sm font-medium text-foreground line-clamp-2 mb-2 leading-snug">
        {session.topic}
      </h3>

      {/* Session ID - truncate */}
      <p className="text-xs text-muted-foreground truncate mb-2">
        {session.id}
      </p>

      {/* Status and Date */}
      <div className="flex items-center justify-between text-xs mt-auto pt-2 border-t">
        <Badge
          variant={session.status === 'completed' ? 'success' : 'warning'}
          className={cn(
            "text-[10px] px-1.5 py-0 cursor-pointer transition-all",
            isStatusFiltered && "ring-2 ring-primary ring-offset-1"
          )}
          onClick={handleStatusClick}
        >
          {session.status === 'completed' ? (
            <><CheckCircle className="w-2.5 h-2.5 mr-0.5" />完成</>
          ) : (
            <><Clock className="w-2.5 h-2.5 mr-0.5" />进行中</>
          )}
        </Badge>
        <span className="text-muted-foreground">{session.createdAt}</span>
      </div>

      {/* Conclusions indicator */}
      {session.hasConclusions && (
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1">
          <FileText className="w-2.5 h-2.5" />
          <span>有结论</span>
        </div>
      )}
    </Card>
  );
}

// ========== Detail Panel Component ==========

interface DetailPanelProps {
  sessionId: string;
  projectPath: string;
}

function DetailPanel({ sessionId, projectPath }: DetailPanelProps) {
  const [activeTab, setActiveTab] = useState('discussion');

  const { data: detail, isLoading, error } = useQuery({
    queryKey: ['analysis-detail', sessionId, projectPath],
    queryFn: () => fetchAnalysisDetail(sessionId, projectPath),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertCircle className="w-5 h-5" />
          <span>加载失败: {(error as Error).message}</span>
        </div>
      </div>
    );
  }

  if (!detail) return null;

  // Build available tabs based on content
  const tabs = [
    { value: 'discussion', label: '讨论记录', icon: <MessageSquare className="w-4 h-4" /> },
    { value: 'conclusions', label: '结论', icon: <CheckCircle className="w-4 h-4" /> },
    { value: 'explorations', label: '代码探索', icon: <Code className="w-4 h-4" /> },
    { value: 'perspectives', label: '视角分析', icon: <FileText className="w-4 h-4" /> },
  ].filter(tab => {
    const key = tab.value as keyof typeof detail;
    return detail[key];
  });

  // Ensure activeTab is valid
  const validTab = tabs.find(t => t.value === activeTab);
  if (!validTab && tabs.length > 0) {
    setActiveTab(tabs[0].value);
  }

  return (
    <div className="h-full flex flex-col">
      {/* Session Info (in drawer, header is already shown) */}
      <div className="px-4 pb-3 border-b shrink-0">
        <div className="min-w-0">
          <h2 className="font-semibold truncate">{detail.topic}</h2>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant={detail.status === 'completed' ? 'default' : 'secondary'} className="text-xs">
              {detail.status === 'completed' ? '完成' : '进行中'}
            </Badge>
            <span className="text-xs text-muted-foreground">{detail.createdAt}</span>
          </div>
        </div>
      </div>

      {/* Tabs Content */}
      {tabs.length > 0 ? (
        <>
          <TabsNavigation
            value={activeTab}
            onValueChange={setActiveTab}
            tabs={tabs}
            className="px-4"
          />
          <div className="flex-1 overflow-auto min-h-0 p-4">
            {/* Discussion Tab */}
            {activeTab === 'discussion' && detail.discussion && (
              <MessageRenderer content={detail.discussion} format="markdown" />
            )}

            {/* Conclusions Tab */}
            {activeTab === 'conclusions' && detail.conclusions && (
              <JsonCardView data={detail.conclusions} />
            )}

            {/* Explorations Tab */}
            {activeTab === 'explorations' && detail.explorations && (
              <JsonCardView data={detail.explorations} />
            )}

            {/* Perspectives Tab */}
            {activeTab === 'perspectives' && detail.perspectives && (
              <JsonCardView data={detail.perspectives} />
            )}
          </div>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          暂无分析内容
        </div>
      )}
    </div>
  );
}

// ========== Main Component ==========

type DateFilter = 'all' | 'today' | 'week' | 'month';
type StatusFilter = 'all' | 'in_progress' | 'completed';

const DATE_FILTERS: { value: DateFilter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'today', label: '今天' },
  { value: 'week', label: '本周' },
  { value: 'month', label: '本月' },
];

const STATUS_FILTERS: { value: StatusFilter; label: string; icon: React.ReactNode }[] = [
  { value: 'all', label: '全部', icon: <FileSearch className="w-4 h-4" /> },
  { value: 'in_progress', label: '进行中', icon: <Clock className="w-4 h-4" /> },
  { value: 'completed', label: '已完成', icon: <CheckCircle className="w-4 h-4" /> },
];

export function AnalysisPage() {
  const projectPath = useWorkflowStore((state) => state.projectPath);
  const isImmersiveMode = useAppStore((s) => s.isImmersiveMode);
  const toggleImmersiveMode = useAppStore((s) => s.toggleImmersiveMode);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: sessions = [], isLoading, error } = useQuery({
    queryKey: ['analysis-sessions', projectPath],
    queryFn: () => fetchAnalysisSessions(projectPath),
  });

  // Get unique dates with counts for quick filter bubbles
  const uniqueDates = useMemo(() => {
    const dateCounts = new Map<string, number>();
    sessions.forEach((session) => {
      const count = dateCounts.get(session.createdAt) || 0;
      dateCounts.set(session.createdAt, count + 1);
    });
    // Sort by date descending, show top 10
    return Array.from(dateCounts.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .slice(0, 10)
      .map(([date, count]) => ({
        date,
        label: date.slice(5), // MM-DD format
        count,
      }));
  }, [sessions]);

  // Filter by date, status and search query
  const filteredSessions = useMemo(() => {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    let filtered = sessions.filter((session) => {
      // Search filter
      const matchesSearch = session.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        session.id.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' || session.status === statusFilter;

      // Date filter
      let matchesDate = true;
      if (selectedDate) {
        matchesDate = session.createdAt === selectedDate;
      } else if (dateFilter === 'today') {
        matchesDate = session.createdAt === today;
      } else if (dateFilter === 'week') {
        matchesDate = session.createdAt >= weekAgo;
      } else if (dateFilter === 'month') {
        matchesDate = session.createdAt >= monthAgo;
      }

      return matchesSearch && matchesStatus && matchesDate;
    });

    // Sort by createdAt descending (newest first)
    return filtered.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [sessions, searchQuery, dateFilter, statusFilter, selectedDate]);

  // Handle date select
  const handleDateSelect = (date: string) => {
    if (selectedDate === date) {
      setSelectedDate(null);
    } else {
      setSelectedDate(date);
      setDateFilter('all');
    }
    setCurrentPage(1);
  };

  // Handle status filter from card click
  const handleStatusClick = (status: string) => {
    if (statusFilter === status) {
      setStatusFilter('all');
    } else {
      setStatusFilter(status as StatusFilter);
    }
    setCurrentPage(1);
  };

  // Pagination
  const totalPages = Math.ceil(filteredSessions.length / PAGE_SIZE);
  const paginatedSessions = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredSessions.slice(start, start + PAGE_SIZE);
  }, [filteredSessions, currentPage]);

  // Reset to page 1 when filters change
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  const handleDateFilterChange = (filter: DateFilter) => {
    setDateFilter(filter);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (filter: StatusFilter) => {
    setStatusFilter(filter);
    setSelectedDate(null);
    setCurrentPage(1);
  };

  return (
    <div className={cn(
      "h-full flex overflow-hidden",
      isImmersiveMode && "fixed inset-0 z-50 bg-background"
    )}>
      {/* Main Content - List */}
      <div className="flex-1 flex flex-col p-4 space-y-3 overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-primary" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Analysis Viewer
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                查看 /workflow:analyze-with-file 命令的分析结果
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              共 {filteredSessions.length} 个会话
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={toggleImmersiveMode}
              title={isImmersiveMode ? '退出全屏' : '全屏模式'}
            >
              {isImmersiveMode ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4 shrink-0">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索分析会话..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {STATUS_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                variant={statusFilter === filter.value ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-3 text-xs gap-1"
                onClick={() => handleStatusFilterChange(filter.value)}
              >
                {filter.icon}
                {filter.label}
              </Button>
            ))}
          </div>

          {/* Date Filter Tabs */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            {DATE_FILTERS.map((filter) => (
              <Button
                key={filter.value}
                variant={dateFilter === filter.value ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={() => handleDateFilterChange(filter.value)}
              >
                {filter.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Date Quick Filter Bubbles */}
        <div className="flex items-center gap-2 flex-wrap shrink-0">
          {uniqueDates.map((date) => (
            <Button
              key={date.date}
              variant={selectedDate === date.date ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => handleDateSelect(date.date)}
            >
              <span>{date.label}</span>
              <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
                {date.count}
              </Badge>
            </Button>
          ))}
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="p-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              <span>加载失败: {(error as Error).message}</span>
            </div>
          </Card>
        ) : filteredSessions.length === 0 ? (
          <Card className="p-12 text-center">
            <FileSearch className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? '没有匹配的分析会话' : '暂无分析会话'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              使用 /workflow:analyze-with-file 命令创建分析
            </p>
          </Card>
        ) : (
          <>
            {/* Grid - flex-1 to fill remaining space */}
            <div className="flex-1 grid grid-cols-4 gap-3 content-start">
              {paginatedSessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  onClick={() => setSelectedSession(session.id)}
                  onStatusClick={handleStatusClick}
                  isStatusFiltered={statusFilter !== 'all'}
                />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(p => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-muted-foreground px-3">
                  {currentPage} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(p => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Drawer */}
      <Drawer open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DrawerContent side="right" className="w-1/2 h-full max-w-none">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>分析详情</DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm" className="absolute right-4 top-4">
                <X className="w-4 h-4" />
              </Button>
            </DrawerClose>
          </DrawerHeader>
          {selectedSession && (
            <DetailPanel
              sessionId={selectedSession}
              projectPath={projectPath}
            />
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}

export default AnalysisPage;
