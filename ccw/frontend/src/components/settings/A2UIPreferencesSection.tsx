// ========================================
// A2UI Preferences Section
// ========================================
// Settings section for A2UI dialog style preferences

import { useIntl } from 'react-intl';
import { MessageSquare, Clock, Volume2, LayoutPanelLeft, Sparkles } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { cn } from '@/lib/utils';
import { useDialogStyleContext, type DialogStyle } from '@/contexts/DialogStyleContext';

// ========== Style Option Button ==========

interface StyleOptionProps {
  value: DialogStyle;
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}

function StyleOption({ value, label, description, selected, onClick }: StyleOptionProps) {
  const icons: Record<DialogStyle, React.ReactNode> = {
    modal: (
      <div className="w-8 h-8 border-2 border-current rounded-lg flex items-center justify-center">
        <div className="w-4 h-3 border border-current rounded-sm" />
      </div>
    ),
    drawer: (
      <div className="w-8 h-8 border-2 border-current rounded-lg flex items-end justify-end p-0.5">
        <div className="w-2 h-6 border border-current rounded-sm" />
      </div>
    ),
    sheet: (
      <div className="w-8 h-8 border-2 border-current rounded-lg flex items-end justify-center p-0.5">
        <div className="w-6 h-2 border border-current rounded-sm" />
      </div>
    ),
    fullscreen: (
      <div className="w-8 h-8 border-2 border-current rounded-lg flex items-center justify-center">
        <div className="w-5 h-4 border border-current rounded-sm" />
      </div>
    ),
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all',
        'hover:bg-accent/50',
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted-foreground'
      )}
    >
      {icons[value]}
      <div className="text-center">
        <div className={cn('text-sm font-medium', selected && 'text-primary')}>{label}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}

// ========== Duration Slider ==========

interface DurationSliderProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
}

function DurationSlider({ value, onChange, disabled }: DurationSliderProps) {
  const presets = [10, 20, 30, 45, 60, 90, 120];

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((seconds) => (
        <Button
          key={seconds}
          type="button"
          variant={value === seconds ? 'default' : 'outline'}
          size="sm"
          disabled={disabled}
          onClick={() => onChange(seconds)}
        >
          {seconds}s
        </Button>
      ))}
    </div>
  );
}

// ========== Main Component ==========

export function A2UIPreferencesSection() {
  const { formatMessage } = useIntl();
  const { preferences, updatePreference, resetPreferences } = useDialogStyleContext();

  const styleOptions: Array<{ value: DialogStyle; label: string; description: string }> = [
    {
      value: 'modal',
      label: formatMessage({ id: 'settings.a2ui.styleModal', defaultMessage: 'Modal' }),
      description: formatMessage({ id: 'settings.a2ui.styleModalDesc', defaultMessage: 'Centered' }),
    },
    {
      value: 'drawer',
      label: formatMessage({ id: 'settings.a2ui.styleDrawer', defaultMessage: 'Drawer' }),
      description: formatMessage({ id: 'settings.a2ui.styleDrawerDesc', defaultMessage: 'Side panel' }),
    },
    {
      value: 'sheet',
      label: formatMessage({ id: 'settings.a2ui.styleSheet', defaultMessage: 'Sheet' }),
      description: formatMessage({ id: 'settings.a2ui.styleSheetDesc', defaultMessage: 'Bottom' }),
    },
    {
      value: 'fullscreen',
      label: formatMessage({ id: 'settings.a2ui.styleFullscreen', defaultMessage: 'Fullscreen' }),
      description: formatMessage({ id: 'settings.a2ui.styleFullscreenDesc', defaultMessage: 'Full screen' }),
    },
  ];

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
        <MessageSquare className="w-5 h-5" />
        {formatMessage({ id: 'settings.sections.a2ui', defaultMessage: 'A2UI Preferences' })}
      </h2>

      <div className="space-y-6">
        {/* Dialog Style Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <LayoutPanelLeft className="w-4 h-4" />
            {formatMessage({ id: 'settings.a2ui.dialogStyle', defaultMessage: 'Dialog Style' })}
          </Label>
          <p className="text-xs text-muted-foreground">
            {formatMessage({
              id: 'settings.a2ui.dialogStyleDesc',
              defaultMessage: 'Choose how A2UI dialogs are displayed',
            })}
          </p>
          <div className="grid grid-cols-4 gap-2">
            {styleOptions.map((option) => (
              <StyleOption
                key={option.value}
                value={option.value}
                label={option.label}
                description={option.description}
                selected={preferences.dialogStyle === option.value}
                onClick={() => updatePreference('dialogStyle', option.value)}
              />
            ))}
          </div>
        </div>

        {/* Smart Mode */}
        <div className="flex items-center justify-between py-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {formatMessage({ id: 'settings.a2ui.smartMode', defaultMessage: 'Smart Mode' })}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatMessage({
                  id: 'settings.a2ui.smartModeDesc',
                  defaultMessage: 'Auto-select style based on question type',
                })}
              </p>
            </div>
          </div>
          <Button
            variant={preferences.smartModeEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => updatePreference('smartModeEnabled', !preferences.smartModeEnabled)}
          >
            {preferences.smartModeEnabled
              ? formatMessage({ id: 'common.enabled', defaultMessage: 'Enabled' })
              : formatMessage({ id: 'common.disabled', defaultMessage: 'Disabled' })}
          </Button>
        </div>

        {/* Auto Selection Duration */}
        <div className="space-y-3 py-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <Label className="text-sm font-medium">
              {formatMessage({ id: 'settings.a2ui.autoSelectionDuration', defaultMessage: 'Auto-Selection Duration' })}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {formatMessage({
              id: 'settings.a2ui.autoSelectionDurationDesc',
              defaultMessage: 'Countdown before auto-selecting default option',
            })}
          </p>
          <DurationSlider
            value={preferences.autoSelectionDuration}
            onChange={(v) => updatePreference('autoSelectionDuration', v)}
          />
        </div>

        {/* Pause on Interaction */}
        <div className="flex items-center justify-between py-2 border-t border-border">
          <div>
            <p className="text-sm font-medium">
              {formatMessage({ id: 'settings.a2ui.pauseOnInteraction', defaultMessage: 'Pause on Interaction' })}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatMessage({
                id: 'settings.a2ui.pauseOnInteractionDesc',
                defaultMessage: 'Pause countdown when you interact with the dialog',
              })}
            </p>
          </div>
          <Button
            variant={preferences.pauseOnInteraction ? 'default' : 'outline'}
            size="sm"
            onClick={() => updatePreference('pauseOnInteraction', !preferences.pauseOnInteraction)}
          >
            {preferences.pauseOnInteraction
              ? formatMessage({ id: 'common.enabled', defaultMessage: 'Enabled' })
              : formatMessage({ id: 'common.disabled', defaultMessage: 'Disabled' })}
          </Button>
        </div>

        {/* Sound Notification */}
        <div className="flex items-center justify-between py-2 border-t border-border">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">
                {formatMessage({ id: 'settings.a2ui.soundNotification', defaultMessage: 'Sound Notification' })}
              </p>
              <p className="text-xs text-muted-foreground">
                {formatMessage({
                  id: 'settings.a2ui.soundNotificationDesc',
                  defaultMessage: 'Play sound before auto-submit (3 seconds before)',
                })}
              </p>
            </div>
          </div>
          <Button
            variant={preferences.autoSelectionSoundEnabled ? 'default' : 'outline'}
            size="sm"
            onClick={() => updatePreference('autoSelectionSoundEnabled', !preferences.autoSelectionSoundEnabled)}
          >
            {preferences.autoSelectionSoundEnabled
              ? formatMessage({ id: 'common.enabled', defaultMessage: 'Enabled' })
              : formatMessage({ id: 'common.disabled', defaultMessage: 'Disabled' })}
          </Button>
        </div>

        {/* Show A2UI Button in Toolbar */}
        <div className="flex items-center justify-between py-2 border-t border-border">
          <div>
            <p className="text-sm font-medium">
              {formatMessage({ id: 'settings.a2ui.showToolbarButton', defaultMessage: 'Show Toolbar Button' })}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatMessage({
                id: 'settings.a2ui.showToolbarButtonDesc',
                defaultMessage: 'Show A2UI quick action button in the toolbar',
              })}
            </p>
          </div>
          <Button
            variant={preferences.showA2UIButtonInToolbar ? 'default' : 'outline'}
            size="sm"
            onClick={() => updatePreference('showA2UIButtonInToolbar', !preferences.showA2UIButtonInToolbar)}
          >
            {preferences.showA2UIButtonInToolbar
              ? formatMessage({ id: 'common.enabled', defaultMessage: 'Enabled' })
              : formatMessage({ id: 'common.disabled', defaultMessage: 'Disabled' })}
          </Button>
        </div>

        {/* Reset Button */}
        <div className="flex justify-end pt-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={resetPreferences}>
            {formatMessage({ id: 'common.resetToDefaults', defaultMessage: 'Reset to Defaults' })}
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default A2UIPreferencesSection;
