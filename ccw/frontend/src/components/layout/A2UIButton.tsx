// ========================================
// A2UI Button Component
// ========================================
// Quick action button for A2UI dialog in toolbar

import { useIntl } from 'react-intl';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDialogStyleContext } from '@/contexts/DialogStyleContext';
import { cn } from '@/lib/utils';

interface A2UIButtonProps {
  className?: string;
  compact?: boolean;
}

export function A2UIButton({ className, compact = false }: A2UIButtonProps) {
  const { formatMessage } = useIntl();
  const { preferences } = useDialogStyleContext();

  // Don't render if hidden in preferences
  if (!preferences.showA2UIButtonInToolbar) {
    return null;
  }

  const handleClick = () => {
    // Trigger A2UI quick action - this would typically open a dialog
    // For now, we'll just log the action
    console.log('[A2UIButton] Quick action triggered');
  };

  return (
    <Button
      variant="default"
      size={compact ? 'icon' : 'sm'}
      onClick={handleClick}
      className={cn(
        'gap-2 bg-primary text-primary-foreground hover:bg-primary/90',
        className
      )}
      title={formatMessage({ id: 'navigation.toolbar.a2ui.quickAction', defaultMessage: 'A2UI Quick Action' })}
    >
      <MessageSquare className="h-4 w-4" />
      {!compact && (
        <span className="hidden sm:inline">
          {formatMessage({ id: 'navigation.toolbar.a2ui.button', defaultMessage: 'A2UI' })}
        </span>
      )}
    </Button>
  );
}

export default A2UIButton;
