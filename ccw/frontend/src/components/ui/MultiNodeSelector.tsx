import * as React from "react";
import { useIntl } from "react-intl";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NodeOption {
  id: string;
  label: string;
  type?: string;
}

export interface MultiNodeSelectorProps {
  availableNodes: NodeOption[];
  selectedNodes: string[];
  onChange: (selectedIds: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
}

const MultiNodeSelector = React.forwardRef<HTMLDivElement, MultiNodeSelectorProps>(
  ({ availableNodes, selectedNodes, onChange, emptyMessage, className }, ref) => {
    const { formatMessage } = useIntl();

    const isSelected = (nodeId: string) => selectedNodes.includes(nodeId);

    const toggleNode = (nodeId: string) => {
      if (isSelected(nodeId)) {
        onChange(selectedNodes.filter((id) => id !== nodeId));
      } else {
        onChange([...selectedNodes, nodeId]);
      }
    };

    const clearSelection = () => {
      onChange([]);
    };

    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        {/* Selected tags */}
        {selectedNodes.length > 0 && (
          <div className="flex flex-wrap gap-2 p-2 rounded-md border border-border bg-muted/30">
            {selectedNodes.map((nodeId) => {
              const node = availableNodes.find((n) => n.id === nodeId);
              return (
                <span
                  key={nodeId}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs"
                >
                  <span>{node?.label || nodeId}</span>
                  <button
                    type="button"
                    onClick={() => toggleNode(nodeId)}
                    className="hover:bg-primary-foreground/20 rounded p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              );
            })}
            <button
              type="button"
              onClick={clearSelection}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              {formatMessage({ id: 'orchestrator.multiNodeSelector.clear' })}
            </button>
          </div>
        )}

        {/* Available nodes list */}
        <div className="border border-border rounded-md bg-background max-h-48 overflow-y-auto">
          {availableNodes.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">
              {emptyMessage || formatMessage({ id: 'orchestrator.multiNodeSelector.empty' })}
            </div>
          ) : (
            <div className="p-1">
              {availableNodes.map((node) => (
                <div
                  key={node.id}
                  onClick={() => toggleNode(node.id)}
                  className={cn(
                    "flex items-center gap-2 p-2 rounded cursor-pointer transition-colors",
                    "hover:bg-muted",
                    isSelected(node.id) && "bg-muted"
                  )}
                >
                  <div
                    className={cn(
                      "w-4 h-4 rounded border flex items-center justify-center",
                      isSelected(node.id)
                        ? "bg-primary border-primary"
                        : "border-border"
                    )}
                  >
                    {isSelected(node.id) && (
                      <Check className="w-3 h-3 text-primary-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {node.label}
                    </div>
                    {node.type && (
                      <div className="text-xs text-muted-foreground">
                        {node.type}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);
MultiNodeSelector.displayName = "MultiNodeSelector";

export { MultiNodeSelector };
