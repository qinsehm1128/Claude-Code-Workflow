// ========================================
// Issue Hub Header
// ========================================
// Dynamic header component for IssueHub

import { useIntl } from 'react-intl';
import { AlertCircle, Radar, ListTodo, LayoutGrid } from 'lucide-react';
import type { IssueTab } from './IssueHubTabs';

interface IssueHubHeaderProps {
  currentTab: IssueTab;
}

export function IssueHubHeader({ currentTab }: IssueHubHeaderProps) {
  const { formatMessage } = useIntl();

  // Tab configuration with icons and labels
  const tabConfig = {
    issues: {
      icon: <AlertCircle className="w-6 h-6 text-primary" />,
      title: formatMessage({ id: 'issues.title' }),
      description: formatMessage({ id: 'issues.description' }),
    },
    board: {
      icon: <LayoutGrid className="w-6 h-6 text-primary" />,
      title: formatMessage({ id: 'issues.board.pageTitle' }),
      description: formatMessage({ id: 'issues.board.description' }),
    },
    queue: {
      icon: <ListTodo className="w-6 h-6 text-primary" />,
      title: formatMessage({ id: 'issues.queue.pageTitle' }),
      description: formatMessage({ id: 'issues.queue.description' }),
    },
    discovery: {
      icon: <Radar className="w-6 h-6 text-primary" />,
      title: formatMessage({ id: 'issues.discovery.pageTitle' }),
      description: formatMessage({ id: 'issues.discovery.description' }),
    },
  };

  const config = tabConfig[currentTab] || tabConfig.issues;

  return (
    <div className="flex items-center gap-2">
      {config.icon}
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {config.title}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          {config.description}
        </p>
      </div>
    </div>
  );
}
