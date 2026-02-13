// ========================================
// Context Assembler Component
// ========================================
// Provides UI for managing context assembly rules
// with variable interpolation templates

import * as React from "react";
import { useIntl } from "react-intl";
import { Info, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ContextRule {
  nodeId: string;
  label?: string;
  variable?: string;
  includeOutput?: boolean;
  transform?: "raw" | "json" | "markdown" | "summary";
}

export interface ContextAssemblerProps {
  value: string; // Template with {{node:nodeId}} or {{var:variableName}} syntax
  onChange: (value: string) => void;
  availableNodes: Array<{ id: string; label: string; type: string; outputVariable?: string }>;
  availableVariables?: string[];
  className?: string;
}

const TRANSFORM_OPTIONS = [
  { value: "raw", label: "Raw Output" },
  { value: "json", label: "JSON Format" },
  { value: "markdown", label: "Markdown" },
  { value: "summary", label: "Summary" },
] as const;

const ContextAssembler = React.forwardRef<HTMLDivElement, ContextAssemblerProps>(
  ({ value, onChange, availableNodes, availableVariables = [], className }, ref) => {
    const { formatMessage } = useIntl();
    const [showHelp, setShowHelp] = React.useState(false);
    const [rules, setRules] = React.useState<ContextRule[]>([]);

    // Parse template to extract existing rules
    React.useEffect(() => {
      const extracted: ContextRule[] = [];
      const nodeRegex = /\{\{node:([^}]+)\}\}/g;
      const varRegex = /\{\{var:([^}]+)\}\}/g;

      let match: RegExpExecArray | null;
      while ((match = nodeRegex.exec(value)) !== null) {
        const node = availableNodes.find((n) => n.id === match![1]);
        extracted.push({
          nodeId: match[1],
          label: node?.label,
          variable: node?.outputVariable,
          includeOutput: true,
          transform: "raw",
        });
      }

      while ((match = varRegex.exec(value)) !== null) {
        extracted.push({
          nodeId: "",
          variable: match[1],
          includeOutput: true,
          transform: "raw",
        });
      }

      setRules(extracted);
    }, [value, availableNodes]);

    const updateTemplate = React.useCallback(
      (newRules: ContextRule[]) => {
        let template = value;

        // Remove all existing node and var references
        template = template.replace(/\{\{node:[^}]+\}\}/g, "").replace(/\{\{var:[^}]+\}\}/g, "");

        // Build new template with rules
        const sections: string[] = [];
        newRules.forEach((rule, index) => {
          const prefix = rule.nodeId ? "node" : "var";
          const ref = rule.nodeId || rule.variable;
          const node = rule.nodeId ? availableNodes.find((n) => n.id === rule.nodeId) : null;
          const label = rule.label || node?.label || ref;

          if (rule.includeOutput) {
            sections.push(`## ${label || `Source ${index + 1}`}`);
            sections.push(`{{${prefix}:${ref}}}`);
            sections.push("");
          }
        });

        onChange(sections.join("\n"));
      },
      [value, availableNodes, onChange]
    );

    const addNode = (nodeId: string) => {
      const node = availableNodes.find((n) => n.id === nodeId);
      if (node && !rules.find((r) => r.nodeId === nodeId)) {
        const newRules: ContextRule[] = [...rules, { nodeId, label: node.label, variable: node.outputVariable, includeOutput: true, transform: "raw" as const }];
        setRules(newRules);
        updateTemplate(newRules);
      }
    };

    const addVariable = (variableName: string) => {
      if (!rules.find((r) => r.variable === variableName && !r.nodeId)) {
        const newRules: ContextRule[] = [...rules, { nodeId: "", variable: variableName, includeOutput: true, transform: "raw" as const }];
        setRules(newRules);
        updateTemplate(newRules);
      }
    };

    const removeRule = (index: number) => {
      const newRules = rules.filter((_, i) => i !== index);
      setRules(newRules);
      updateTemplate(newRules);
    };

    const updateRuleTransform = (index: number, transform: ContextRule["transform"]) => {
      const newRules = [...rules];
      newRules[index] = { ...newRules[index], transform };
      setRules(newRules);
      updateTemplate(newRules);
    };

    return (
      <div ref={ref} className={cn("space-y-3", className)}>
        {/* Header with help toggle */}
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">
            {formatMessage({ id: "orchestrator.contextAssembler.title" })}
          </label>
          <button
            type="button"
            onClick={() => setShowHelp(!showHelp)}
            className="text-muted-foreground hover:text-foreground"
          >
            <Info className="w-4 h-4" />
          </button>
        </div>

        {/* Help panel */}
        {showHelp && (
          <div className="p-3 rounded-md bg-muted/50 border border-border text-xs text-muted-foreground">
            <p className="mb-2 font-medium text-foreground">
              {formatMessage({ id: "orchestrator.contextAssembler.helpTitle" })}
            </p>
            <ul className="space-y-1 list-disc list-inside">
              <li>{formatMessage({ id: "orchestrator.contextAssembler.helpSyntax1" })}</li>
              <li>{formatMessage({ id: "orchestrator.contextAssembler.helpSyntax2" })}</li>
              <li>{formatMessage({ id: "orchestrator.contextAssembler.helpSyntax3" })}</li>
            </ul>
          </div>
        )}

        {/* Current rules list */}
        {rules.length > 0 && (
          <div className="space-y-2">
            {rules.map((rule, index) => {
              const node = rule.nodeId ? availableNodes.find((n) => n.id === rule.nodeId) : null;
              const label = rule.label || node?.label || rule.variable || `Source ${index + 1}`;

              return (
                <div key={index} className="flex items-center gap-2 p-2 rounded-md border border-border bg-background">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{label}</div>
                    <div className="text-xs text-muted-foreground">
                      {rule.nodeId ? `{{node:${rule.nodeId}}}` : `{{var:${rule.variable}}}`}
                    </div>
                  </div>
                  <select
                    value={rule.transform || "raw"}
                    onChange={(e) => updateRuleTransform(index, e.target.value as ContextRule["transform"])}
                    className="h-8 px-2 text-xs rounded border border-border bg-background"
                  >
                    {TRANSFORM_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeRule(index)}
                    className="p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add node selector */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            {formatMessage({ id: "orchestrator.contextAssembler.addNode" })}
          </label>
          <select
            value=""
            onChange={(e) => e.target.value && addNode(e.target.value)}
            className="w-full h-9 px-2 text-sm rounded-md border border-border bg-background"
          >
            <option value="">{formatMessage({ id: "orchestrator.contextAssembler.selectNode" })}</option>
            {availableNodes
              .filter((n) => !rules.find((r) => r.nodeId === n.id))
              .map((node) => (
                <option key={node.id} value={node.id}>
                  {node.label || node.id} ({node.type})
                </option>
              ))}
          </select>
        </div>

        {/* Add variable selector */}
        {availableVariables.length > 0 && (
          <div>
            <label className="block text-xs text-muted-foreground mb-1">
              {formatMessage({ id: "orchestrator.contextAssembler.addVariable" })}
            </label>
            <select
              value=""
              onChange={(e) => e.target.value && addVariable(e.target.value)}
              className="w-full h-9 px-2 text-sm rounded-md border border-border bg-background"
            >
              <option value="">{formatMessage({ id: "orchestrator.contextAssembler.selectVariable" })}</option>
              {availableVariables
                .filter((v) => !rules.find((r) => r.variable === v && !r.nodeId))
                .map((variableName) => (
                  <option key={variableName} value={variableName}>
                    {`{{${variableName}}}`}
                  </option>
                ))}
            </select>
          </div>
        )}

        {/* Manual template editor */}
        <div>
          <label className="block text-xs text-muted-foreground mb-1">
            {formatMessage({ id: "orchestrator.contextAssembler.manualEdit" })}
          </label>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={formatMessage({ id: "orchestrator.propertyPanel.placeholders.contextTemplate" })}
            className="w-full h-24 px-3 py-2 rounded-md border border-border bg-background text-sm resize-none font-mono"
          />
        </div>
      </div>
    );
  }
);

ContextAssembler.displayName = "ContextAssembler";

export { ContextAssembler };
