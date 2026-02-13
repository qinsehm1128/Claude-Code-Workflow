import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/Dialog';

interface VersionCheckModalProps {
  currentVersion: string;
  latestVersion: string;
  onClose: () => void;
}

export function VersionCheckModal({ currentVersion, latestVersion, onClose }: VersionCheckModalProps) {
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>新版本可用</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-between">
            <span>当前版本:</span>
            <span className="font-mono">{currentVersion}</span>
          </div>
          <div className="flex justify-between">
            <span>最新版本:</span>
            <span className="font-mono text-green-600">{latestVersion}</span>
          </div>

          <div className="bg-muted p-4 rounded">
            <h4 className="font-medium mb-2">更新说明</h4>
            <p className="text-sm text-muted-foreground">
              请访问 GitHub Releases 页面查看详细更新内容。
            </p>
          </div>

          <div className="flex gap-2">
            <a
              href="https://github.com/dyw0830/ccw/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
            >
              查看更新
            </a>
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded hover:bg-muted"
            >
              关闭
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
