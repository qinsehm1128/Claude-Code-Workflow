// ========================================
// A2UI Button Component
// ========================================
// Quick action button for A2UI dialog in toolbar

import { useIntl } from 'react-intl';
import { MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useDialogStyleContext } from '@/contexts/DialogStyleContext';
import { cn } from '@/lib/utils';
import { useNotificationStore } from '@/stores';

interface A2UIButtonProps {
  className?: string;
  compact?: boolean;
}



export function A2UIButton({ className, compact = false }: A2UIButtonProps) {
  const { formatMessage } = useIntl();
  const { preferences } = useDialogStyleContext();
  const a2uiSurfaces = useNotificationStore((state) => state.a2uiSurfaces);
  const isA2UIAvailable = a2uiSurfaces.size > 0;

  // Don't render if hidden in preferences
  if (!preferences.showA2UIButtonInToolbar) {
    return null;
  }

  const handleClick = () => {
    // This would typically open the most relevant A2UI dialog
    // For now, we'll just log the action
    if (isA2UIAvailable) {
      console.log('[A2UIButton] Quick action triggered');
      // Example: find the first popup surface and handle it
      const firstPopupId = Array.from(a2uiSurfaces.keys()).find(id => a2uiSurfaces.get(id)?.displayMode === 'popup');
      if(firstPopupId) {
        // In a real implementation, you might open a dialog here
        // using the surface data.
        console.log(`[A2UIButton] Would open dialog for surface: ${firstPopupId}`);
      }
    }
  };

  const buttonTitle = isA2UIAvailable
    ? formatMessage({ id: 'navigation.toolbar.a2ui.quickAction', defaultMessage: 'A2UI Quick Action' })
    : formatMessage({ id: 'navigation.toolbar.a2ui.unavailable', defaultMessage: 'No A2UI action available' });

  return (
    <Button
      variant="default"
      size={compact ? 'icon' : 'sm'}
      onClick={handleClick}
      disabled={!isA2UIAvailable}
      className={cn(
        'gap-2 bg-primary text-primary-foreground hover:bg-primary/90',
        !isA2UIAvailable && 'bg-muted-foreground/30 hover:bg-muted-foreground/30',
        className
      )}
      title={buttonTitle}
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
