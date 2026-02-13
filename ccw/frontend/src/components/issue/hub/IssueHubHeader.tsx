// ========================================
// Issue Hub Header
// ========================================
// Dynamic header component for IssueHub

import { useIntl } from 'react-intl';
import { AlertCircle, Radar, ListTodo, LayoutGrid, Activity, Terminal } from 'lucide-react';

type IssueTab = 'issues' | 'board' | 'queue' | 'discovery' | 'observability' | 'executions';

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
    observability: {
      icon: <Activity className="w-6 h-6 text-primary" />,
      title: formatMessage({ id: 'issues.observability.pageTitle' }),
      description: formatMessage({ id: 'issues.observability.description' }),
    },
    executions: {
      icon: <Terminal className="w-6 h-6 text-primary" />,
      title: formatMessage({ id: 'issues.executions.pageTitle' }),
      description: formatMessage({ id: 'issues.executions.description' }),
    },
  };

  const config = tabConfig[currentTab];

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
