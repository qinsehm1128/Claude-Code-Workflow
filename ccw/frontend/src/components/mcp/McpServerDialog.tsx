// ========================================
// MCP Server Dialog Component
// ========================================
// Add/Edit dialog for MCP server configuration with dynamic template loading
// Supports both STDIO and HTTP transport types

import { useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Plus, Trash2, Globe, Terminal } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  createMcpServer,
  updateMcpServer,
  fetchMcpServers,
  saveMcpTemplate,
  type McpServer,
  type McpProjectConfigType,
  isStdioMcpServer,
  isHttpMcpServer,
} from '@/lib/api';
import { mcpServersKeys, useMcpTemplates, useNotifications } from '@/hooks';
import { cn } from '@/lib/utils';
import { ConfigTypeToggle, type McpConfigType } from './ConfigTypeToggle';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

// ========== Types ==========

export type McpTransportType = 'stdio' | 'http';

export interface HttpHeader {
  id: string;
  name: string;
  value: string;
  isEnvVar: boolean;
}

export interface McpServerDialogProps {
  mode: 'add' | 'edit';
  server?: McpServer;
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
}

// Re-export McpTemplate for convenience
export type { McpTemplate } from '@/types/store';

interface McpServerFormData {
  name: string;
  // STDIO fields
  command: string;
  args: string[];
  env: Record<string, string>;
  // HTTP fields
  url: string;
  headers: HttpHeader[];
  bearerTokenEnvVar: string;
  // Common fields
  scope: 'project' | 'global';
  enabled: boolean;
}

interface FormErrors {
  name?: string;
  command?: string;
  args?: string;
  env?: string;
  url?: string;
  headers?: string;
}

// ========== Helper Component: HttpHeadersInput ==========

interface HttpHeadersInputProps {
  headers: HttpHeader[];
  onChange: (headers: HttpHeader[]) => void;
  disabled?: boolean;
}

function HttpHeadersInput({ headers, onChange, disabled }: HttpHeadersInputProps) {
  const { formatMessage } = useIntl();
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const generateId = () => `header-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const handleAdd = () => {
    onChange([...headers, { id: generateId(), name: '', value: '', isEnvVar: false }]);
  };

  const handleRemove = (id: string) => {
    onChange(headers.filter((h) => h.id !== id));
  };

  const handleUpdate = (id: string, field: keyof HttpHeader, value: string | boolean) => {
    onChange(headers.map((h) => (h.id === id ? { ...h, [field]: value } : h)));
  };

  const toggleReveal = (id: string) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-2">
      {headers.map((header) => (
        <div key={header.id} className="flex items-center gap-2">
          {/* Header Name */}
          <Input
            value={header.name}
            onChange={(e) => handleUpdate(header.id, 'name', e.target.value)}
            placeholder={formatMessage({ id: 'mcp.dialog.form.http.headerName' })}
            className="flex-1"
            disabled={disabled}
          />
          {/* Header Value */}
          <div className="relative flex-1">
            <Input
              type={revealedIds.has(header.id) ? 'text' : 'password'}
              value={header.value}
              onChange={(e) => handleUpdate(header.id, 'value', e.target.value)}
              placeholder={formatMessage({ id: 'mcp.dialog.form.http.headerValue' })}
              className="pr-8"
              disabled={disabled}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-0 top-0 h-full px-2"
              onClick={() => toggleReveal(header.id)}
              disabled={disabled}
            >
              {revealedIds.has(header.id) ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
          </div>
          {/* Env Var Toggle */}
          <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
            <input
              type="checkbox"
              checked={header.isEnvVar}
              onChange={(e) => handleUpdate(header.id, 'isEnvVar', e.target.checked)}
              className="w-3 h-3"
              disabled={disabled}
            />
            {formatMessage({ id: 'mcp.dialog.form.http.isEnvVar' })}
          </label>
          {/* Delete Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => handleRemove(header.id)}
            disabled={disabled}
            className="text-destructive"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={disabled}
        className="w-full"
      >
        <Plus className="w-4 h-4 mr-1" />
        {formatMessage({ id: 'mcp.dialog.form.http.addHeader' })}
      </Button>
    </div>
  );
}

// ========== Main Component ==========

export function McpServerDialog({
  mode,
  server,
  open,
  onClose,
  onSave,
}: McpServerDialogProps) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const projectPath = useWorkflowStore(selectProjectPath);
  const { error: showError } = useNotifications();

  // Fetch templates from backend
  const { templates, isLoading: templatesLoading } = useMcpTemplates();

  // Transport type state
  const [transportType, setTransportType] = useState<McpTransportType>('stdio');

  // Form state
  const [formData, setFormData] = useState<McpServerFormData>({
    name: '',
    command: '',
    args: [],
    env: {},
    url: '',
    headers: [],
    bearerTokenEnvVar: '',
    scope: 'project',
    enabled: true,
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [argsInput, setArgsInput] = useState('');
  const [envInput, setEnvInput] = useState('');
  const [configType, setConfigType] = useState<McpConfigType>('mcp-json');
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const projectConfigType: McpProjectConfigType = configType === 'claude-json' ? 'claude' : 'mcp';

  // Helper to detect transport type from server data
  const detectTransportType = useCallback((serverData: McpServer | undefined): McpTransportType => {
    if (!serverData) return 'stdio';
    // Use type guard to check for HTTP server
    if (isHttpMcpServer(serverData)) return 'http';
    return 'stdio';
  }, []);

  // Initialize form from server prop (edit mode)
  useEffect(() => {
    if (server && mode === 'edit') {
      const detectedType = detectTransportType(server);
      setTransportType(detectedType);

      // Parse HTTP headers if present (for HTTP servers)
      const httpHeaders: HttpHeader[] = [];
      if (isHttpMcpServer(server)) {
        // HTTP server - extract headers
        if (server.httpHeaders) {
          Object.entries(server.httpHeaders).forEach(([name, value], idx) => {
            httpHeaders.push({
              id: `header-http-${idx}`,
              name,
              value,
              isEnvVar: false,
            });
          });
        }
        if (server.envHttpHeaders) {
          // envHttpHeaders is an array of header names that get values from env vars
          server.envHttpHeaders.forEach((headerName, idx) => {
            httpHeaders.push({
              id: `header-env-${idx}`,
              name: headerName,
              value: '', // Env var name is not stored in value
              isEnvVar: true,
            });
          });
        }
      }

      // Get STDIO fields safely using type guard
      const stdioCommand = isStdioMcpServer(server) ? server.command : '';
      const stdioArgs = isStdioMcpServer(server) ? (server.args || []) : [];
      const stdioEnv = isStdioMcpServer(server) ? (server.env || {}) : {};

      // Get HTTP fields safely using type guard
      const httpUrl = isHttpMcpServer(server) ? server.url : '';
      const httpBearerToken = isHttpMcpServer(server) ? (server.bearerTokenEnvVar || '') : '';

      setFormData({
        name: server.name,
        command: stdioCommand,
        args: stdioArgs,
        env: stdioEnv,
        url: httpUrl,
        headers: httpHeaders,
        bearerTokenEnvVar: httpBearerToken,
        scope: server.scope,
        enabled: server.enabled,
      });
      setArgsInput(stdioArgs.join(', '));
      setEnvInput(
        Object.entries(stdioEnv)
          .map(([k, v]) => `${k}=${v}`)
          .join('\n')
      );
    } else {
      // Reset form for add mode
      setTransportType('stdio');
      setFormData({
        name: '',
        command: '',
        args: [],
        env: {},
        url: '',
        headers: [],
        bearerTokenEnvVar: '',
        scope: 'project',
        enabled: true,
      });
      setArgsInput('');
      setEnvInput('');
    }
    setSelectedTemplate('');
    setSaveAsTemplate(false);
    setErrors({});
  }, [server, mode, open, detectTransportType]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: ({ server, configType }: { server: McpServer; configType?: McpProjectConfigType }) =>
      createMcpServer(server, { projectPath: projectPath ?? undefined, configType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
      handleClose();
      onSave?.();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ serverName, config, configType }: { serverName: string; config: Partial<McpServer>; configType?: McpProjectConfigType }) =>
      updateMcpServer(serverName, config, { projectPath: projectPath ?? undefined, configType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
      handleClose();
      onSave?.();
    },
  });

  // Handlers
  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.name === templateId);
    if (template) {
      setFormData((prev) => ({
        ...prev,
        command: template.serverConfig.command,
        args: template.serverConfig.args || [],
        env: template.serverConfig.env || {},
      }));
      setArgsInput((template.serverConfig.args || []).join(', '));
      setEnvInput(
        Object.entries(template.serverConfig.env || {})
          .map(([k, v]) => `${k}=${v}`)
          .join('\n')
      );
      setSelectedTemplate(templateId);
    }
  };

  const handleFieldChange = (
    field: keyof McpServerFormData,
    value: string | boolean | string[] | Record<string, string> | HttpHeader[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleArgsChange = (value: string) => {
    setArgsInput(value);
    const argsArray = value
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    setFormData((prev) => ({ ...prev, args: argsArray }));
    if (errors.args) {
      setErrors((prev) => ({ ...prev, args: undefined }));
    }
  };

  const handleEnvChange = (value: string) => {
    setEnvInput(value);
    const envObj: Record<string, string> = {};
    const lines = value.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes('=')) {
        const [key, ...valParts] = trimmed.split('=');
        const val = valParts.join('=');
        if (key) {
          envObj[key.trim()] = val.trim();
        }
      }
    }
    setFormData((prev) => ({ ...prev, env: envObj }));
    if (errors.env) {
      setErrors((prev) => ({ ...prev, env: undefined }));
    }
  };

  const handleHeadersChange = (headers: HttpHeader[]) => {
    setFormData((prev) => ({ ...prev, headers }));
    if (errors.headers) {
      setErrors((prev) => ({ ...prev, headers: undefined }));
    }
  };

  const handleTransportTypeChange = (type: McpTransportType) => {
    setTransportType(type);
    // Clear relevant errors when switching
    setErrors((prev) => ({
      ...prev,
      command: undefined,
      url: undefined,
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name required
    if (!formData.name.trim()) {
      newErrors.name = formatMessage({ id: 'mcp.dialog.validation.nameRequired' });
    }

    // Transport-specific validation
    if (transportType === 'stdio') {
      // Command required for STDIO
      if (!formData.command.trim()) {
        newErrors.command = formatMessage({ id: 'mcp.dialog.validation.commandRequired' });
      }
    } else {
      // URL required for HTTP
      if (!formData.url.trim()) {
        newErrors.url = formatMessage({ id: 'mcp.dialog.validation.urlRequired' });
      }
      // Validate URL format
      try {
        new URL(formData.url);
      } catch {
        newErrors.url = formatMessage({ id: 'mcp.dialog.validation.urlInvalid' });
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkNameExists = async (name: string): Promise<boolean> => {
    try {
      const data = await fetchMcpServers(projectPath ?? undefined);
      const allServers = [...data.project, ...data.global];
      // In edit mode, exclude current server
      return allServers.some(
        (s) => s.name === name && (mode === 'edit' ? s.name !== server?.name : true)
      );
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    // Check name uniqueness
    if (await checkNameExists(formData.name)) {
      setErrors({ name: formatMessage({ id: 'mcp.dialog.validation.nameExists' }) });
      return;
    }

    // Build server config based on transport type using discriminated union
    let serverConfig: McpServer;

    if (transportType === 'stdio') {
      serverConfig = {
        name: formData.name,
        transport: 'stdio',
        command: formData.command,
        args: formData.args.length > 0 ? formData.args : undefined,
        env: Object.keys(formData.env).length > 0 ? formData.env : undefined,
        scope: formData.scope,
        enabled: formData.enabled,
      };
    } else {
      // HTTP transport - separate headers into static and env-based
      const httpHeaders: Record<string, string> = {};
      const envHttpHeaders: string[] = [];

      formData.headers.forEach((h) => {
        if (h.name.trim()) {
          if (h.isEnvVar) {
            // For env-based headers, store the header name that will be populated from env var
            envHttpHeaders.push(h.name.trim());
          } else {
            httpHeaders[h.name.trim()] = h.value.trim();
          }
        }
      });

      serverConfig = {
        name: formData.name,
        transport: 'http',
        url: formData.url,
        headers: Object.keys(httpHeaders).length > 0 ? httpHeaders : undefined,
        httpHeaders: Object.keys(httpHeaders).length > 0 ? httpHeaders : undefined,
        envHttpHeaders: envHttpHeaders.length > 0 ? envHttpHeaders : undefined,
        bearerTokenEnvVar: formData.bearerTokenEnvVar.trim() || undefined,
        scope: formData.scope,
        enabled: formData.enabled,
      };
    }

    // Save as template if checked (only for STDIO)
    if (saveAsTemplate && transportType === 'stdio') {
      try {
        await saveMcpTemplate({
          name: formData.name,
          category: 'custom',
          serverConfig: {
            command: formData.command,
            args: formData.args.length > 0 ? formData.args : undefined,
            env: Object.keys(formData.env).length > 0 ? formData.env : undefined,
          },
        });
      } catch (err) {
        showError(formatMessage({ id: 'mcp.templates.feedback.saveError' }), err instanceof Error ? err.message : String(err));
        // Template save failure should not block server creation
      }
    }

    if (mode === 'add') {
      createMutation.mutate({
        server: serverConfig,
        configType: formData.scope === 'project' ? projectConfigType : undefined,
      });
    } else {
      updateMutation.mutate({
        serverName: server!.name,
        config: serverConfig,
        configType: formData.scope === 'project' ? projectConfigType : undefined,
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'add'
              ? formatMessage({ id: 'mcp.dialog.addTitle' })
              : formatMessage({ id: 'mcp.dialog.editTitle' }, { name: server?.name })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selector - Only for STDIO */}
          {transportType === 'stdio' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                {formatMessage({ id: 'mcp.dialog.form.template' })}
              </label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect} disabled={templatesLoading}>
                <SelectTrigger className="w-full">
                  <SelectValue
                    placeholder={templatesLoading
                      ? formatMessage({ id: 'mcp.templates.loading' })
                      : formatMessage({ id: 'mcp.dialog.form.templatePlaceholder' })
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {templates.length === 0 ? (
                    <SelectItem value="__empty__" disabled>
                      {formatMessage({ id: 'mcp.templates.empty.title' })}
                    </SelectItem>
                  ) : (
                    templates.map((template) => (
                      <SelectItem key={template.name} value={template.name}>
                        <div className="flex flex-col">
                          <span className="font-medium">{template.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {template.description || formatMessage({ id: 'mcp.dialog.form.templatePlaceholder' })}
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'mcp.dialog.form.name' })}
              <span className="text-destructive ml-1">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder={formatMessage({ id: 'mcp.dialog.form.namePlaceholder' })}
              error={!!errors.name}
              disabled={mode === 'edit'} // Name cannot be changed in edit mode
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Transport Type Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'mcp.dialog.form.transportType' })}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="transportType"
                  value="stdio"
                  checked={transportType === 'stdio'}
                  onChange={() => handleTransportTypeChange('stdio')}
                  className="w-4 h-4"
                  disabled={mode === 'edit'}
                />
                <Terminal className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  {formatMessage({ id: 'mcp.dialog.form.transportStdio' })}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="transportType"
                  value="http"
                  checked={transportType === 'http'}
                  onChange={() => handleTransportTypeChange('http')}
                  className="w-4 h-4"
                  disabled={mode === 'edit'}
                />
                <Globe className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">
                  {formatMessage({ id: 'mcp.dialog.form.transportHttp' })}
                </span>
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'mcp.dialog.form.transportHint' })}
            </p>
          </div>

          {/* STDIO Fields */}
          {transportType === 'stdio' && (
            <>
              {/* Command */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {formatMessage({ id: 'mcp.dialog.form.command' })}
                  <span className="text-destructive ml-1">*</span>
                </label>
                <Input
                  value={formData.command}
                  onChange={(e) => handleFieldChange('command', e.target.value)}
                  placeholder={formatMessage({ id: 'mcp.dialog.form.commandPlaceholder' })}
                  error={!!errors.command}
                />
                {errors.command && (
                  <p className="text-sm text-destructive">{errors.command}</p>
                )}
              </div>

              {/* Args */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {formatMessage({ id: 'mcp.dialog.form.args' })}
                </label>
                <Input
                  value={argsInput}
                  onChange={(e) => handleArgsChange(e.target.value)}
                  placeholder={formatMessage({ id: 'mcp.dialog.form.argsPlaceholder' })}
                  error={!!errors.args}
                />
                <p className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'mcp.dialog.form.argsHint' })}
                </p>
                {formData.args.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {formData.args.map((arg, idx) => (
                      <Badge key={idx} variant="secondary" className="font-mono text-xs">
                        {arg}
                      </Badge>
                    ))}
                  </div>
                )}
                {errors.args && (
                  <p className="text-sm text-destructive">{errors.args}</p>
                )}
              </div>

              {/* Environment Variables */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {formatMessage({ id: 'mcp.dialog.form.env' })}
                </label>
                <textarea
                  value={envInput}
                  onChange={(e) => handleEnvChange(e.target.value)}
                  placeholder={formatMessage({ id: 'mcp.dialog.form.envPlaceholder' })}
                  className={cn(
                    'flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                    errors.env && 'border-destructive focus-visible:ring-destructive'
                  )}
                />
                <p className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'mcp.dialog.form.envHint' })}
                </p>
                {Object.keys(formData.env).length > 0 && (
                  <div className="space-y-1 mt-2">
                    {Object.entries(formData.env).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="font-mono">
                          {key}
                        </Badge>
                        <span className="text-muted-foreground">=</span>
                        <code className="text-xs bg-muted px-2 py-1 rounded flex-1 overflow-x-auto">
                          {value}
                        </code>
                      </div>
                    ))}
                  </div>
                )}
                {errors.env && (
                  <p className="text-sm text-destructive">{errors.env}</p>
                )}
              </div>
            </>
          )}

          {/* HTTP Fields */}
          {transportType === 'http' && (
            <>
              {/* URL */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {formatMessage({ id: 'mcp.dialog.form.http.url' })}
                  <span className="text-destructive ml-1">*</span>
                </label>
                <Input
                  value={formData.url}
                  onChange={(e) => handleFieldChange('url', e.target.value)}
                  placeholder={formatMessage({ id: 'mcp.dialog.form.http.urlPlaceholder' })}
                  error={!!errors.url}
                />
                {errors.url && (
                  <p className="text-sm text-destructive">{errors.url}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'mcp.dialog.form.http.urlHint' })}
                </p>
              </div>

              {/* Bearer Token Env Var */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {formatMessage({ id: 'mcp.dialog.form.http.bearerToken' })}
                </label>
                <Input
                  value={formData.bearerTokenEnvVar}
                  onChange={(e) => handleFieldChange('bearerTokenEnvVar', e.target.value)}
                  placeholder={formatMessage({ id: 'mcp.dialog.form.http.bearerTokenPlaceholder' })}
                />
                <p className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'mcp.dialog.form.http.bearerTokenHint' })}
                </p>
              </div>

              {/* HTTP Headers */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  {formatMessage({ id: 'mcp.dialog.form.http.headers' })}
                </label>
                <HttpHeadersInput
                  headers={formData.headers}
                  onChange={handleHeadersChange}
                  disabled={isPending}
                />
                <p className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'mcp.dialog.form.http.headersHint' })}
                </p>
                {errors.headers && (
                  <p className="text-sm text-destructive">{errors.headers}</p>
                )}
              </div>
            </>
          )}

          {/* Scope */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'mcp.dialog.form.scope' })}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="project"
                  checked={formData.scope === 'project'}
                  onChange={(e) => handleFieldChange('scope', e.target.value as 'project' | 'global')}
                  className="w-4 h-4"
                  disabled={mode === 'edit'}
                />
                <span className="text-sm">
                  {formatMessage({ id: 'mcp.scope.project' })}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="global"
                  checked={formData.scope === 'global'}
                  onChange={(e) => handleFieldChange('scope', e.target.value as 'project' | 'global')}
                  className="w-4 h-4"
                  disabled={mode === 'edit'}
                />
                <span className="text-sm">
                  {formatMessage({ id: 'mcp.scope.global' })}
                </span>
              </label>
            </div>

            {/* Config Type Toggle - Only for project scope */}
            {formData.scope === 'project' && (
              <div className="flex items-center gap-2 mt-2 pl-6">
                <span className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'mcp.configType.format' })}:
                </span>
                <ConfigTypeToggle
                  currentType={configType}
                  onTypeChange={setConfigType}
                  showWarning={false}
                />
              </div>
            )}
          </div>

          {/* Enabled */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => handleFieldChange('enabled', e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="enabled" className="text-sm font-medium text-foreground cursor-pointer">
              {formatMessage({ id: 'mcp.dialog.form.enabled' })}
            </label>
          </div>

          {/* Save as Template - Only for STDIO */}
          {transportType === 'stdio' && (
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="save-as-template"
                checked={saveAsTemplate}
                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="save-as-template" className="text-sm font-medium text-foreground cursor-pointer">
                {formatMessage({ id: 'mcp.templates.actions.saveAsTemplate' })}
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
          >
            {formatMessage({ id: 'mcp.dialog.actions.cancel' })}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending
              ? formatMessage({ id: 'mcp.dialog.actions.saving' })
              : formatMessage({ id: 'mcp.dialog.actions.save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default McpServerDialog;
