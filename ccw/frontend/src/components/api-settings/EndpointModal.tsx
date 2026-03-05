// ========================================
// Endpoint Modal Component
// ========================================
// Add/Edit endpoint modal with cache configuration

import { useState, useEffect, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Database,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Textarea } from '@/components/ui/Textarea';
import { Switch } from '@/components/ui/Switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/Collapsible';
import { useCreateEndpoint, useUpdateEndpoint, useProviders } from '@/hooks/useApiSettings';
import { useNotifications } from '@/hooks/useNotifications';
import type { CustomEndpoint, CacheStrategy } from '@/lib/api';

// ========== Types ==========

export interface EndpointModalProps {
  open: boolean;
  onClose: () => void;
  endpoint?: CustomEndpoint | null;
}

// ========== Helper Components ==========

interface FilePatternInputProps {
  value: string[];
  onChange: (patterns: string[]) => void;
  placeholder: string;
}

function FilePatternInput({ value, onChange, placeholder }: FilePatternInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleAddPattern = () => {
    if (inputValue.trim() && !value.includes(inputValue.trim())) {
      onChange([...value, inputValue.trim()]);
      setInputValue('');
    }
  };

  const handleRemovePattern = (pattern: string) => {
    onChange(value.filter((p) => p !== pattern));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddPattern();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" size="sm" onClick={handleAddPattern}>
          <Check className="w-4 h-4" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((pattern) => (
            <span
              key={pattern}
              className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-xs"
            >
              {pattern}
              <button
                type="button"
                onClick={() => handleRemovePattern(pattern)}
                className="hover:text-destructive"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ========== Main Component ==========

export function EndpointModal({ open, onClose, endpoint }: EndpointModalProps) {
  const { formatMessage } = useIntl();
  const { error } = useNotifications();
  const isEditing = !!endpoint;

  // Mutations
  const { createEndpoint, isCreating } = useCreateEndpoint();
  const { updateEndpoint, isUpdating } = useUpdateEndpoint();

  // Get providers for dropdown
  const { providers } = useProviders();

  // Form state
  const [id, setId] = useState('');
  const [name, setName] = useState('');
  const [providerId, setProviderId] = useState('');
  const [model, setModel] = useState('');
  const [description, setDescription] = useState('');
  const [enabled, setEnabled] = useState(true);

  // Cache strategy
  const [showCacheSettings, setShowCacheSettings] = useState(false);
  const [enableCache, setEnableCache] = useState(false);
  const [cacheTTL, setCacheTTL] = useState(60);
  const [cacheMaxSize, setCacheMaxSize] = useState(1024);
  const [filePatterns, setFilePatterns] = useState<string[]>([]);

  // Get available models for selected provider
  const availableModels = useMemo(() => {
    if (!providerId) return [];
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) return [];

    const models: string[] = [];
    if (provider.llmModels) {
      models.push(...provider.llmModels.filter((m) => m.enabled).map((m) => m.id));
    }
    if (provider.embeddingModels) {
      models.push(...provider.embeddingModels.filter((m) => m.enabled).map((m) => m.id));
    }
    if (provider.rerankerModels) {
      models.push(...provider.rerankerModels.filter((m) => m.enabled).map((m) => m.id));
    }
    return models;
  }, [providerId, providers]);

  // Initialize form from endpoint
  useEffect(() => {
    if (endpoint) {
      setId(endpoint.id);
      setName(endpoint.name);
      setProviderId(endpoint.providerId);
      setModel(endpoint.model);
      setDescription(endpoint.description || '');
      setEnabled(endpoint.enabled);
      setEnableCache(endpoint.cacheStrategy.enabled);
      setCacheTTL(endpoint.cacheStrategy.ttlMinutes);
      setCacheMaxSize(endpoint.cacheStrategy.maxSizeKB);
      setFilePatterns(endpoint.cacheStrategy.filePatterns || []);
    } else {
      // Reset form for new endpoint
      setId('');
      setName('');
      setProviderId('');
      setModel('');
      setDescription('');
      setEnabled(true);
      setEnableCache(false);
      setCacheTTL(60);
      setCacheMaxSize(1024);
      setFilePatterns([]);
    }
  }, [endpoint, open]);

  // Reset model when provider changes
  useEffect(() => {
    if (!isEditing && providerId) {
      const provider = providers.find((p) => p.id === providerId);
      if (provider && provider.llmModels && provider.llmModels.length > 0) {
        setModel(provider.llmModels[0].id);
      }
    }
  }, [providerId, providers, isEditing]);

  const handleSubmit = async () => {
    try {
      const cacheStrategy: CacheStrategy = {
        enabled: enableCache,
        ttlMinutes: cacheTTL,
        maxSizeKB: cacheMaxSize,
        filePatterns: enableCache ? filePatterns : [],
      };

      const endpointData = {
        id,
        name,
        providerId,
        model,
        description: description || undefined,
        enabled,
        cacheStrategy,
      };

      if (isEditing && endpoint) {
        await updateEndpoint(endpoint.id, endpointData);
      } else {
        await createEndpoint(endpointData);
      }

      onClose();
    } catch (err) {
      error(formatMessage({ id: 'apiSettings.endpoints.saveError' }));
    }
  };

  const isSaving = isCreating || isUpdating;

  // Validate form
  const isValid = id.trim() && name.trim() && providerId && model.trim();

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isEditing
              ? formatMessage({ id: 'apiSettings.endpoints.actions.edit' })
              : formatMessage({ id: 'apiSettings.endpoints.actions.add' })}
          </DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'apiSettings.endpoints.description' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">{formatMessage({ id: 'apiSettings.providers.basicInfo' })}</h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="endpointId">{formatMessage({ id: 'apiSettings.endpoints.endpointId' })} *</Label>
                <Input
                  id="endpointId"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  placeholder="my-gpt4o"
                  disabled={isEditing}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">{formatMessage({ id: 'apiSettings.endpoints.endpointIdHint' })}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">{formatMessage({ id: 'apiSettings.endpoints.name' })} *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="My GPT-4o"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="providerId">{formatMessage({ id: 'apiSettings.endpoints.provider' })} *</Label>
              <Select value={providerId} onValueChange={setProviderId} disabled={isEditing}>
                <SelectTrigger id="providerId">
                  <SelectValue
                    placeholder={providers.length === 0
                      ? formatMessage({ id: 'apiSettings.providers.addProviderFirst' })
                      : formatMessage({ id: 'apiSettings.endpoints.selectProvider' })
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {providers.map((provider) => (
                    <SelectItem key={provider.id} value={provider.id} disabled={!provider.enabled}>
                      {provider.name}
                      {!provider.enabled && ` (${formatMessage({ id: 'apiSettings.common.disabled' })})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">{formatMessage({ id: 'apiSettings.endpoints.model' })} *</Label>
              {availableModels.length === 0 && providerId ? (
                <Input
                  id="model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder=""
                  className="font-mono"
                />
              ) : (
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger id="model">
                    <SelectValue
                      placeholder={!providerId
                        ? formatMessage({ id: 'apiSettings.endpoints.selectProvider' })
                        : formatMessage({ id: 'apiSettings.endpoints.selectModel' })
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {availableModels.map((modelId) => (
                      <SelectItem key={modelId} value={modelId}>
                        {modelId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">{formatMessage({ id: 'apiSettings.common.description' })}</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={formatMessage({ id: 'apiSettings.common.optional' })}
                rows={2}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="enabled"
                checked={enabled}
                onCheckedChange={setEnabled}
              />
              <Label htmlFor="enabled">{formatMessage({ id: 'apiSettings.endpoints.enabled' })}</Label>
            </div>
          </div>

          {/* Cache Strategy */}
          <Collapsible open={showCacheSettings} onOpenChange={setShowCacheSettings}>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" className="w-full justify-between">
                <span className="flex items-center gap-2 font-semibold">
                  <Database className="w-4 h-4" />
                  {formatMessage({ id: 'apiSettings.endpoints.cacheStrategy' })}
                </span>
                {showCacheSettings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{formatMessage({ id: 'apiSettings.endpoints.enableContextCaching' })}</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatMessage({ id: 'apiSettings.endpoints.cacheStrategy' })}
                  </p>
                </div>
                <Switch
                  checked={enableCache}
                  onCheckedChange={setEnableCache}
                />
              </div>

              {enableCache && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cacheTTL">{formatMessage({ id: 'apiSettings.endpoints.cacheTTL' })}</Label>
                      <Input
                        id="cacheTTL"
                        type="number"
                        min="1"
                        value={cacheTTL}
                        onChange={(e) => setCacheTTL(parseInt(e.target.value) || 60)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cacheMaxSize">{formatMessage({ id: 'apiSettings.endpoints.cacheMaxSize' })}</Label>
                      <Input
                        id="cacheMaxSize"
                        type="number"
                        min="1"
                        value={cacheMaxSize}
                        onChange={(e) => setCacheMaxSize(parseInt(e.target.value) || 1024)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>{formatMessage({ id: 'apiSettings.endpoints.autoCachePatterns' })}</Label>
                    <FilePatternInput
                      value={filePatterns}
                      onChange={setFilePatterns}
                      placeholder="*.md,*.ts"
                    />
                    <p className="text-xs text-muted-foreground">{formatMessage({ id: 'apiSettings.endpoints.filePatternsHint' })}</p>
                  </div>
                </>
              )}
            </CollapsibleContent>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
            {formatMessage({ id: 'apiSettings.common.cancel' })}
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !isValid}>
            {isSaving ? (
              <Database className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            {formatMessage({ id: 'apiSettings.common.save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EndpointModal;
