// ========================================
// Issue Hub Tabs
// ========================================
// Tab navigation for IssueHub

import { useIntl } from 'react-intl';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

// Keep in sync with IssueHubHeader/IssueHubPage
export type IssueTab = 'issues' | 'queue' | 'discovery';

interface IssueHubTabsProps {
  currentTab: IssueTab;
  onTabChange: (tab: IssueTab) => void;
}

export function IssueHubTabs({ currentTab, onTabChange }: IssueHubTabsProps) {
  const { formatMessage } = useIntl();

  const tabs: Array<{ value: IssueTab; label: string }> = [
    { value: 'issues', label: formatMessage({ id: 'issues.hub.tabs.issues' }) },
    { value: 'queue', label: formatMessage({ id: 'issues.hub.tabs.queue' }) },
    { value: 'discovery', label: formatMessage({ id: 'issues.hub.tabs.discovery' }) },
  ];

  return (
    <div className="flex gap-2 border-b border-border">
      {tabs.map((tab) => (
        <Button
          key={tab.value}
          variant="ghost"
          className={cn(
            "border-b-2 rounded-none h-11 px-4",
            currentTab === tab.value
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
          onClick={() => onTabChange(tab.value)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
