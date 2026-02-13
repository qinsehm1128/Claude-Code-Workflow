// ========================================
// useTemplates Hook
// ========================================
// TanStack Query hooks for template API operations

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { FlowTemplate, TemplateInstallRequest, TemplateExportRequest } from '../types/execution';
import type { Flow } from '../types/flow';

// API base URL
const API_BASE = '/api/orchestrator';

// Query keys
export const templateKeys = {
  all: ['templates'] as const,
  lists: () => [...templateKeys.all, 'list'] as const,
  list: (filters?: Record<string, unknown>) => [...templateKeys.lists(), filters] as const,
  details: () => [...templateKeys.all, 'detail'] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
  categories: () => [...templateKeys.all, 'categories'] as const,
};

// API response types
interface TemplatesListResponse {
  templates: FlowTemplate[];
  total: number;
  categories: string[];
}

interface TemplateDetailResponse extends FlowTemplate {
  flow: Flow;
}

interface InstallTemplateResponse {
  flow: Flow;
  message: string;
}

interface ExportTemplateResponse {
  template: FlowTemplate;
  message: string;
}

// ========== Fetch Functions ==========

function toFlowTemplate(raw: any): FlowTemplate {
  const meta = raw?.template_metadata ?? {};
  const nodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const edges = Array.isArray(raw?.edges) ? raw.edges : [];

  return {
    id: String(raw?.id ?? ''),
    name: String(raw?.name ?? ''),
    description: (typeof meta.description === 'string' ? meta.description : raw?.description) || undefined,
    category: typeof meta.category === 'string' ? meta.category : undefined,
    tags: Array.isArray(meta.tags) ? meta.tags : undefined,
    author: typeof meta.author === 'string' ? meta.author : undefined,
    version: String(meta.version ?? raw?.version ?? '1.0.0'),
    created_at: String(raw?.created_at ?? new Date().toISOString()),
    updated_at: String(raw?.updated_at ?? new Date().toISOString()),
    nodeCount: nodes.length,
    edgeCount: edges.length,
  };
}

function toFlowFromTemplate(raw: any): Flow {
  const meta = raw?.template_metadata ?? {};
  const now = new Date().toISOString();
  return {
    id: `flow-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    name: String(raw?.name ?? 'Template Flow'),
    description: (typeof meta.description === 'string' ? meta.description : raw?.description) || undefined,
    version: String(meta.version ?? raw?.version ?? '1.0.0'),
    created_at: String(raw?.created_at ?? now),
    updated_at: String(raw?.updated_at ?? now),
    nodes: Array.isArray(raw?.nodes) ? raw.nodes : [],
    edges: Array.isArray(raw?.edges) ? raw.edges : [],
    variables: typeof raw?.variables === 'object' && raw.variables ? raw.variables : {},
    metadata: {
      source: 'template',
      templateId: typeof raw?.id === 'string' ? raw.id : undefined,
      tags: Array.isArray(meta.tags) ? meta.tags : undefined,
      category: typeof meta.category === 'string' ? meta.category : undefined,
    },
  };
}

async function fetchTemplates(category?: string): Promise<TemplatesListResponse> {
  const url = category
    ? `${API_BASE}/templates?category=${encodeURIComponent(category)}`
    : `${API_BASE}/templates`;
  const response = await fetch(url, { credentials: 'same-origin' });
  if (!response.ok) {
    throw new Error(`Failed to fetch templates: ${response.statusText}`);
  }
  const json = await response.json();
  const rawTemplates: any[] = Array.isArray(json?.data) ? json.data : (json?.templates || []);
  const templates: FlowTemplate[] = rawTemplates.map(toFlowTemplate);
  const total = typeof json?.total === 'number' ? json.total : templates.length;
  const categories = Array.from(new Set(
    templates
      .map((t) => t.category)
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0)
  ));
  return { templates, total, categories };
}

async function fetchTemplate(id: string): Promise<TemplateDetailResponse> {
  const response = await fetch(`${API_BASE}/templates/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch template: ${response.statusText}`);
  }
  return response.json();
}

async function installTemplate(request: TemplateInstallRequest): Promise<InstallTemplateResponse> {
  const response = await fetch(`${API_BASE}/templates/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to install template: ${response.statusText}`);
  }
  const json = await response.json();
  const template = (json && typeof json === 'object' && 'data' in json) ? json.data : json;
  return { flow: toFlowFromTemplate(template), message: json?.message || 'Template installed' };
}

async function exportTemplate(request: TemplateExportRequest): Promise<ExportTemplateResponse> {
  const response = await fetch(`${API_BASE}/templates/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to export template: ${response.statusText}`);
  }
  const json = await response.json();
  const template = (json && typeof json === 'object' && 'data' in json) ? json.data : json;
  return { template: toFlowTemplate(template), message: json?.message || 'Template exported' };
}

async function deleteTemplate(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/templates/${id}`, {
    method: 'DELETE',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(`Failed to delete template: ${response.statusText}`);
  }
}

// ========== Query Hooks ==========

/**
 * Fetch all templates
 */
export function useTemplates(category?: string) {
  return useQuery({
    queryKey: templateKeys.list({ category }),
    queryFn: () => fetchTemplates(category),
    staleTime: 60000, // 1 minute
  });
}

/**
 * Fetch a single template by ID
 */
export function useTemplate(id: string | null) {
  return useQuery({
    queryKey: templateKeys.detail(id ?? ''),
    queryFn: () => fetchTemplate(id!),
    enabled: !!id,
    staleTime: 60000,
  });
}

// ========== Mutation Hooks ==========

/**
 * Install a template as a new flow
 */
export function useInstallTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: installTemplate,
    onSuccess: () => {
      // Invalidate flows list to show the new flow
      queryClient.invalidateQueries({ queryKey: ['flows'] });
    },
  });
}

/**
 * Export a flow as a template
 */
export function useExportTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: exportTemplate,
    onSuccess: (result) => {
      // Add to templates list
      queryClient.setQueryData<TemplatesListResponse>(templateKeys.lists(), (old) => {
        if (!old) return { templates: [result.template], total: 1, categories: [] };
        return {
          ...old,
          templates: [...old.templates, result.template],
          total: old.total + 1,
        };
      });
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

/**
 * Delete a template
 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTemplate,
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: templateKeys.detail(deletedId) });
      queryClient.setQueryData<TemplatesListResponse>(templateKeys.lists(), (old) => {
        if (!old) return old;
        return {
          ...old,
          templates: old.templates.filter((t) => t.id !== deletedId),
          total: old.total - 1,
        };
      });
    },
  });
}
