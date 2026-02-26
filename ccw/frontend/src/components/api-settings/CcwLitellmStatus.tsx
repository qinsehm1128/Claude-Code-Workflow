// ========================================
// CCW-LiteLLM Status & Install Component
// ========================================
// Shows ccw-litellm installation status with install/uninstall actions

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Download,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Package,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  useCcwLitellmStatus,
  useInstallCcwLitellm,
  useUninstallCcwLitellm,
} from '@/hooks/useApiSettings';
import { useNotifications } from '@/hooks/useNotifications';
import { LitellmInstallProgressOverlay } from './LitellmInstallProgressOverlay';

export function CcwLitellmStatus() {
  const { formatMessage } = useIntl();
  const { success, error: notifyError } = useNotifications();
  const [refresh, setRefresh] = useState(false);
  const [isInstallOverlayOpen, setIsInstallOverlayOpen] = useState(false);

  const { data: status, isLoading, refetch } = useCcwLitellmStatus({ refresh });
  const { install, isInstalling } = useInstallCcwLitellm();
  const { uninstall, isUninstalling } = useUninstallCcwLitellm();

  const isBusy = isInstalling || isUninstalling;

  const handleInstallViaOverlay = async (): Promise<{ success: boolean }> => {
    try {
      await install();
      success(formatMessage({ id: 'apiSettings.ccwLitellm.messages.installSuccess' }));
      return { success: true };
    } catch {
      notifyError(formatMessage({ id: 'apiSettings.ccwLitellm.messages.installFailed' }));
      return { success: false };
    }
  };

  const handleInstallSuccess = () => {
    setRefresh(true);
    refetch();
  };

  const handleUninstall = async () => {
    try {
      await uninstall();
      success(formatMessage({ id: 'apiSettings.ccwLitellm.messages.uninstallSuccess' }));
      setRefresh(true);
      refetch();
    } catch {
      notifyError(formatMessage({ id: 'apiSettings.ccwLitellm.messages.uninstallFailed' }));
    }
  };

  const handleRefresh = () => {
    setRefresh(true);
    refetch();
  };

  const installed = status?.installed ?? false;
  const version = status?.version;
  const systemPythonInstalled = status?.checks?.systemPython?.installed === true;
  const showSystemPythonMismatch = !isLoading && !installed && systemPythonInstalled;

  return (
    <>
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-primary" />
            <div>
              <h3 className="text-sm font-medium">
                {formatMessage({ id: 'apiSettings.ccwLitellm.title' })}
              </h3>
              <p className="text-xs text-muted-foreground">
                {formatMessage({ id: 'apiSettings.ccwLitellm.description' })}
              </p>
              {showSystemPythonMismatch && (
                <div className="mt-1 flex items-start gap-2 text-xs text-warning-foreground/80">
                  <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                  <p>{formatMessage({ id: 'apiSettings.ccwLitellm.systemPythonMismatch' })}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Status badge */}
            {isLoading ? (
              <Badge variant="secondary" className="gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                ...
              </Badge>
            ) : installed ? (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {formatMessage({ id: 'apiSettings.ccwLitellm.status.installed' })}
                {version && ` v${version}`}
              </Badge>
            ) : (
              <Badge variant="destructive" className="gap-1">
                <XCircle className="w-3 h-3" />
                {formatMessage({ id: 'apiSettings.ccwLitellm.status.notInstalled' })}
              </Badge>
            )}

            {/* Refresh */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              disabled={isBusy || isLoading}
              aria-label={formatMessage({ id: 'apiSettings.ccwLitellm.actions.refreshStatus' })}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>

            {/* Install / Uninstall */}
            {installed ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUninstall}
                disabled={isBusy}
              >
                {isUninstalling ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-1" />
                )}
                {formatMessage({ id: 'apiSettings.ccwLitellm.actions.uninstall' })}
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsInstallOverlayOpen(true)}
                disabled={isBusy}
              >
                {isInstalling ? (
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-1" />
                )}
                {formatMessage({ id: 'apiSettings.ccwLitellm.actions.install' })}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>

      {/* Install Progress Overlay */}
      <LitellmInstallProgressOverlay
        open={isInstallOverlayOpen}
        onOpenChange={setIsInstallOverlayOpen}
        onInstall={handleInstallViaOverlay}
        onSuccess={handleInstallSuccess}
      />
    </>
  );
}

export default CcwLitellmStatus;
