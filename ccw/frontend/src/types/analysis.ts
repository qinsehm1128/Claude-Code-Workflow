/**
 * Analysis Session Types
 * Types for the Analysis Viewer feature
 */

/**
 * Analysis session summary for list view
 */
export interface AnalysisSessionSummary {
  id: string;
  name: string;
  topic: string;
  createdAt: string;
  status: 'in_progress' | 'completed';
  hasConclusions: boolean;
}

/**
 * Analysis conclusions structure
 */
export interface AnalysisConclusions {
  session_id: string;
  topic: string;
  completed: string;
  total_rounds: number;
  summary: string;
  key_conclusions: Array<{
    point: string;
    evidence: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
  recommendations: Array<{
    action: string;
    rationale: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  open_questions: string[];
}

/**
 * Analysis explorations structure
 */
export interface AnalysisExplorations {
  session_id: string;
  timestamp: string;
  topic: string;
  dimensions: string[];
  key_findings: string[];
  discussion_points: string[];
  open_questions: string[];
}

/**
 * Analysis perspectives structure
 */
export interface AnalysisPerspectives {
  session_id: string;
  timestamp: string;
  topic: string;
  perspectives: Array<{
    name: string;
    tool: string;
    findings: string[];
    insights: string[];
  }>;
  synthesis: {
    convergent_themes: string[];
    conflicting_views: string[];
  };
}

/**
 * Analysis session detail
 */
export interface AnalysisSessionDetail {
  id: string;
  name: string;
  topic: string;
  createdAt: string;
  status: 'in_progress' | 'completed';
  discussion: string | null;
  conclusions: AnalysisConclusions | null;
  explorations: AnalysisExplorations | null;
  perspectives: AnalysisPerspectives | null;
}
