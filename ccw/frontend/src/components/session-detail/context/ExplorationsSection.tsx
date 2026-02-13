// ========================================
// ExplorationsSection Component
// ========================================
// Displays exploration data with collapsible sections

import { useIntl } from 'react-intl';
import {
  GitBranch,
  Search,
  Link,
  TestTube,
  FolderOpen,
  FileText,
  Layers
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ExplorationCollapsible } from './ExplorationCollapsible';

export interface ExplorationsData {
  manifest: {
    task_description: string;
    complexity?: string;
    exploration_count: number;
  };
  data: Record<string, {
    project_structure?: string[];
    relevant_files?: string[];
    patterns?: string[];
    dependencies?: string[];
    integration_points?: string[];
    testing?: string[];
  }>;
}

export interface ExplorationsSectionProps {
  data?: ExplorationsData;
}

/**
 * ExplorationsSection component - Displays all exploration angles
 */
export function ExplorationsSection({ data }: ExplorationsSectionProps) {
  const { formatMessage } = useIntl();

  if (!data || !data.data || Object.keys(data.data).length === 0) {
    return null;
  }

  const explorationEntries = Object.entries(data.data);

  return (
    <Card>
      <CardContent className="p-6">
        <h3 className="text-sm font-medium text-foreground mb-4 flex items-center gap-2">
          <Search className="w-4 h-4" />
          {formatMessage({ id: 'sessionDetail.context.explorations.title' })}
          <Badge variant="secondary">
            {data.manifest.exploration_count} {formatMessage({ id: 'sessionDetail.context.explorations.angles' })}
          </Badge>
        </h3>
        <div className="space-y-3">
          {explorationEntries.map(([angle, angleData]) => (
            <ExplorationCollapsible
              key={angle}
              title={formatAngleTitle(angle)}
              icon={<Search className="w-4 h-4 text-muted-foreground" />}
            >
              <AngleContent data={angleData} />
            </ExplorationCollapsible>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface AngleContentProps {
  data: {
    project_structure?: unknown;
    relevant_files?: unknown;
    patterns?: unknown;
    dependencies?: unknown;
    integration_points?: unknown;
    testing?: unknown;
    [key: string]: unknown;
  };
}

/** Extract a displayable string from unknown value (handles objects with path/name/etc.) */
function extractString(val: unknown): string {
  if (typeof val === 'string') return val;
  if (val && typeof val === 'object') {
    const obj = val as Record<string, unknown>;
    // Common field names for file-like objects
    if (typeof obj.path === 'string') return obj.path;
    if (typeof obj.name === 'string') return obj.name;
    if (typeof obj.file === 'string') return obj.file;
    if (typeof obj.title === 'string') return obj.title;
    // Fallback: first string-valued property
    for (const v of Object.values(obj)) {
      if (typeof v === 'string' && v.length > 0) return v;
    }
  }
  return String(val);
}

/** Extract a secondary description from an object (rationale, reason, description, etc.) */
function extractReason(val: unknown): string | undefined {
  if (!val || typeof val !== 'object') return undefined;
  const obj = val as Record<string, unknown>;
  if (typeof obj.rationale === 'string') return obj.rationale;
  if (typeof obj.reason === 'string') return obj.reason;
  if (typeof obj.description === 'string') return obj.description;
  return undefined;
}

/** Safely coerce a field to items – preserving object metadata for files */
function toItems(val: unknown): Array<{ text: string; reason?: string }> {
  if (Array.isArray(val)) {
    return val.map((item) => ({
      text: extractString(item),
      reason: extractReason(item),
    }));
  }
  if (typeof val === 'string' && val.length > 0) return [{ text: val }];
  return [];
}

/** Per-section color theme */
const sectionThemes: Record<string, { icon: string; border: string; bg: string; badge: string }> = {
  project_structure:  { icon: 'text-blue-500',   border: 'border-l-blue-500',   bg: 'bg-blue-500/5',   badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  relevant_files:     { icon: 'text-violet-500',  border: 'border-l-violet-500',  bg: 'bg-violet-500/5',  badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  patterns:           { icon: 'text-amber-500',  border: 'border-l-amber-500',  bg: 'bg-amber-500/5',  badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  dependencies:       { icon: 'text-emerald-500', border: 'border-l-emerald-500', bg: 'bg-emerald-500/5', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  integration_points: { icon: 'text-cyan-500',   border: 'border-l-cyan-500',   bg: 'bg-cyan-500/5',   badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' },
  testing:            { icon: 'text-rose-500',   border: 'border-l-rose-500',   bg: 'bg-rose-500/5',   badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
};

const defaultTheme = { icon: 'text-muted-foreground', border: 'border-l-border', bg: 'bg-muted/30', badge: 'bg-muted text-foreground' };

function AngleContent({ data }: AngleContentProps) {
  const { formatMessage } = useIntl();

  const sectionDefs: Array<{
    key: string;
    field: unknown;
    icon: JSX.Element;
    labelId: string;
    renderAs: 'paths' | 'text';
  }> = [
    { key: 'project_structure',  field: data.project_structure,  icon: <FolderOpen className="w-3.5 h-3.5" />, labelId: 'sessionDetail.context.explorations.projectStructure', renderAs: 'text' },
    { key: 'relevant_files',     field: data.relevant_files,     icon: <FileText className="w-3.5 h-3.5" />,   labelId: 'sessionDetail.context.explorations.relevantFiles',   renderAs: 'paths' },
    { key: 'patterns',           field: data.patterns,           icon: <Layers className="w-3.5 h-3.5" />,     labelId: 'sessionDetail.context.explorations.patterns',        renderAs: 'text' },
    { key: 'dependencies',       field: data.dependencies,       icon: <GitBranch className="w-3.5 h-3.5" />,  labelId: 'sessionDetail.context.explorations.dependencies',    renderAs: 'text' },
    { key: 'integration_points', field: data.integration_points, icon: <Link className="w-3.5 h-3.5" />,       labelId: 'sessionDetail.context.explorations.integrationPoints', renderAs: 'text' },
    { key: 'testing',            field: data.testing,            icon: <TestTube className="w-3.5 h-3.5" />,   labelId: 'sessionDetail.context.explorations.testing',         renderAs: 'text' },
  ];

  const sections = sectionDefs
    .map((def) => ({ ...def, items: toItems(def.field) }))
    .filter((s) => s.items.length > 0);

  if (sections.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No data available</p>;
  }

  return (
    <div className="space-y-3">
      {sections.map((section) => {
        const theme = sectionThemes[section.key] || defaultTheme;
        return (
          <div key={section.key} className={`border-l-2 ${theme.border} ${theme.bg} rounded-r pl-3 py-2 pr-2`}>
            <h4 className={`text-xs font-medium uppercase tracking-wide mb-1.5 flex items-center gap-1.5 ${theme.icon}`}>
              {section.icon}
              {formatMessage({ id: section.labelId })}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-normal normal-case tracking-normal ${theme.badge}`}>
                {section.items.length}
              </span>
            </h4>
            {section.renderAs === 'paths' ? (
              <div className="flex flex-wrap gap-1.5">
                {section.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 px-2 py-1 bg-background rounded border text-[11px] font-mono text-foreground"
                    title={item.reason}
                  >
                    <FileText className={`w-3 h-3 flex-shrink-0 ${theme.icon}`} />
                    {item.text}
                  </div>
                ))}
              </div>
            ) : (
              <ul className="space-y-1">
                {section.items.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                    <span className={`mt-0.5 ${theme.icon}`}>•</span>
                    <span className="flex-1">
                      <FormattedTextItem text={item.text} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** Render text with inline code/path highlighting */
function FormattedTextItem({ text }: { text: string }) {
  // Split on backtick-wrapped segments
  const parts = text.split(/(`[^`]+`)/g);
  if (parts.length === 1) {
    // No backtick segments – highlight embedded file paths
    const pathParts = text.split(/(\S+\/\S+\.\w+)/g);
    if (pathParts.length === 1) return <>{text}</>;
    return (
      <>
        {pathParts.map((part, i) =>
          /\S+\/\S+\.\w+/.test(part) ? (
            <code key={i} className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">{part}</code>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </>
    );
  }
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith('`') && part.endsWith('`') ? (
          <code key={i} className="px-1 py-0.5 bg-muted rounded text-[10px] font-mono">
            {part.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}

function formatAngleTitle(angle: string): string {
  return angle
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase()
    .replace(/^\w/, (c) => c.toUpperCase());
}
