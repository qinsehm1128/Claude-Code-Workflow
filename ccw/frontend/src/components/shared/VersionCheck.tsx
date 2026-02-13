import { useEffect, useState } from 'react';
import { Badge } from '../ui/Badge';
import { toast } from 'sonner';
import { VersionCheckModal } from './VersionCheckModal';

interface VersionData {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
}

interface VersionCheckResponse {
  success: boolean;
  data?: VersionData;
  error?: string;
}

/**
 * Safely parse localStorage item
 * Returns default value if parsing fails
 */
function safeParseLocalStorage<T>(key: string, defaultValue: T): T {
  try {
    const saved = localStorage.getItem(key);
    if (saved === null) return defaultValue;
    return JSON.parse(saved) as T;
  } catch {
    // Corrupted data, remove and return default
    localStorage.removeItem(key);
    return defaultValue;
  }
}

export function VersionCheck() {
  const [versionData, setVersionData] = useState<VersionData | null>(null);
  const [autoCheck, setAutoCheck] = useState(() => {
    return safeParseLocalStorage('ccw.autoUpdate', true);
  });
  const [checking, setChecking] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const checkVersion = async (silent = false) => {
    if (!silent) setChecking(true);
    try {
      const response = await fetch('/api/config/version');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: VersionCheckResponse = await response.json();

      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format');
      }

      if (!data.success) {
        throw new Error(data.error || 'Version check failed');
      }

      if (!data.data || typeof data.data !== 'object') {
        throw new Error('Invalid version data in response');
      }

      setVersionData(data.data);

      if (data.data.updateAvailable && !silent) {
        toast.info('新版本可用: ' + data.data.latestVersion);
      }
    } catch (error) {
      console.error('Version check failed:', error);
      if (!silent) {
        toast.error('版本检查失败: ' + (error instanceof Error ? error.message : '未知错误'));
      }
    } finally {
      setChecking(false);
    }
  };

  // Auto-check on mount and interval
  useEffect(() => {
    if (!autoCheck) return;

    // Initial check after 2 seconds delay
    const timer = setTimeout(() => checkVersion(true), 2000);

    // Periodic check every hour
    const interval = setInterval(() => checkVersion(true), 60 * 60 * 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [autoCheck]);

  const toggleAutoCheck = (enabled: boolean) => {
    setAutoCheck(enabled);
    localStorage.setItem('ccw.autoUpdate', JSON.stringify(enabled));
  };

  if (!versionData?.updateAvailable) {
    return null; // Don't show anything if no update
  }

  return (
    <>
      <Badge
        variant="warning"
        className="cursor-pointer"
        onClick={() => setShowModal(true)}
      >
        有新版本
      </Badge>

      <button
        onClick={() => checkVersion()}
        disabled={checking}
        className="ml-2 px-2 py-1 text-sm"
      >
        {checking ? '检查中...' : '立即检查'}
      </button>

      <label className="ml-4 flex items-center gap-2">
        <input
          type="checkbox"
          checked={autoCheck}
          onChange={(e) => toggleAutoCheck(e.target.checked)}
        />
        <span className="text-sm">自动检查</span>
      </label>

      {showModal && (
        <VersionCheckModal
          currentVersion={versionData.currentVersion}
          latestVersion={versionData.latestVersion}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
