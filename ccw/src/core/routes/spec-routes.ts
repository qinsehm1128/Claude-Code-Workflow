/**
 * Spec Routes Module
 * Handles all spec management API endpoints
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { resolvePath } from '../../utils/path-resolver.js';
import type { RouteContext } from './types.js';

/**
 * Handle Spec routes
 * @returns true if route was handled, false otherwise
 */
export async function handleSpecRoutes(ctx: RouteContext): Promise<boolean> {
  const { pathname, url, req, res, initialPath, handlePostRequest } = ctx;

  // API: List all specs from index
  if (pathname === '/api/specs/list' && req.method === 'GET') {
    const projectPath = url.searchParams.get('path') || initialPath;
    const resolvedPath = resolvePath(projectPath);

    try {
      const { getDimensionIndex, SPEC_DIMENSIONS } = await import(
        '../../tools/spec-index-builder.js'
      );

      const result: Record<string, unknown[]> = {};

      for (const dim of SPEC_DIMENSIONS) {
        const index = await getDimensionIndex(resolvedPath, dim);
        result[dim] = index.entries;
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ specs: result }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // API: Get spec detail (MD content)
  if (pathname === '/api/specs/detail' && req.method === 'GET') {
    const projectPath = url.searchParams.get('path') || initialPath;
    const resolvedPath = resolvePath(projectPath);
    const file = url.searchParams.get('file');

    if (!file) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing file parameter' }));
      return true;
    }

    const filePath = join(resolvedPath, file);

    if (!existsSync(filePath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'File not found' }));
      return true;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ content }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // API: Update frontmatter (toggle readMode)
  if (pathname === '/api/specs/update-frontmatter' && req.method === 'PUT') {
    handlePostRequest(req, res, async (body) => {
      const projectPath = url.searchParams.get('path') || initialPath;
      const resolvedPath = resolvePath(projectPath);
      const data = body as { file: string; readMode: string };

      if (!data.file || !data.readMode) {
        return { error: 'Missing file or readMode', status: 400 };
      }

      const filePath = join(resolvedPath, data.file);

      if (!existsSync(filePath)) {
        return { error: 'File not found', status: 404 };
      }

      try {
        const matter = (await import('gray-matter')).default;
        const raw = readFileSync(filePath, 'utf-8');
        const parsed = matter(raw);

        parsed.data.readMode = data.readMode;

        const updated = matter.stringify(parsed.content, parsed.data);
        writeFileSync(filePath, updated, 'utf-8');

        return { success: true, readMode: data.readMode };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // API: Rebuild index
  if (pathname === '/api/specs/rebuild' && req.method === 'POST') {
    handlePostRequest(req, res, async () => {
      const projectPath = url.searchParams.get('path') || initialPath;
      const resolvedPath = resolvePath(projectPath);

      try {
        const { buildAllIndices, readCachedIndex, SPEC_DIMENSIONS } = await import(
          '../../tools/spec-index-builder.js'
        );

        await buildAllIndices(resolvedPath);

        const stats: Record<string, number> = {};
        for (const dim of SPEC_DIMENSIONS) {
          const cached = readCachedIndex(resolvedPath, dim);
          stats[dim] = cached?.entries.length ?? 0;
        }

        return { success: true, stats };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // API: Init spec system
  if (pathname === '/api/specs/init' && req.method === 'POST') {
    handlePostRequest(req, res, async () => {
      const projectPath = url.searchParams.get('path') || initialPath;
      const resolvedPath = resolvePath(projectPath);

      try {
        const { initSpecSystem } = await import('../../tools/spec-init.js');
        const result = initSpecSystem(resolvedPath);
        return { success: true, ...result };
      } catch (err) {
        return { error: (err as Error).message, status: 500 };
      }
    });
    return true;
  }

  // API: Get spec stats (optimized - uses cached contentLength)
  if (pathname === '/api/specs/stats' && req.method === 'GET') {
    const projectPath = url.searchParams.get('path') || initialPath;
    const resolvedPath = resolvePath(projectPath);

    try {
      const { getDimensionIndex, SPEC_DIMENSIONS } = await import(
        '../../tools/spec-index-builder.js'
      );

      // Get maxLength from system settings
      let maxLength = 8000;
      const settingsPath = join(homedir(), '.claude', 'settings.json');

      if (existsSync(settingsPath)) {
        try {
          const rawSettings = readFileSync(settingsPath, 'utf-8');
          const settings = JSON.parse(rawSettings) as {
            system?: { injectionControl?: { maxLength?: number } };
          };
          maxLength = settings?.system?.injectionControl?.maxLength || 8000;
        } catch { /* ignore */ }
      }

      const dimensions: Record<string, { count: number; requiredCount: number }> = {};
      let totalRequiredLength = 0;
      let totalWithKeywords = 0;

      for (const dim of SPEC_DIMENSIONS) {
        const index = await getDimensionIndex(resolvedPath, dim);
        let count = 0;
        let requiredCount = 0;

        for (const entry of index.entries) {
          count++;
          // Use cached contentLength instead of re-reading file
          const contentLength = entry.contentLength || 0;

          if (entry.readMode === 'required') {
            requiredCount++;
            totalRequiredLength += contentLength;
          }
          totalWithKeywords += contentLength;
        }

        dimensions[dim] = { count, requiredCount };
      }

      const percentage = totalWithKeywords > 0 ? Math.round((totalWithKeywords / maxLength) * 100) : 0;

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        dimensions,
        injectionLength: {
          requiredOnly: totalRequiredLength,
          withKeywords: totalWithKeywords,
          maxLength,
          percentage
        }
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  // API: Get injection preview (files list and content preview)
  if (pathname === '/api/specs/injection-preview' && req.method === 'GET') {
    const projectPath = url.searchParams.get('path') || initialPath;
    const resolvedPath = resolvePath(projectPath);
    const mode = url.searchParams.get('mode') || 'required'; // required | all | keywords
    const preview = url.searchParams.get('preview') === 'true';
    const category = url.searchParams.get('category') || undefined; // optional category filter

    try {
      const { getDimensionIndex, SPEC_DIMENSIONS } = await import(
        '../../tools/spec-index-builder.js'
      );

      interface InjectionFile {
        file: string;
        title: string;
        dimension: string;
        category: string;
        scope: string;
        readMode: string;
        priority: string;
        contentLength: number;
        content?: string;
      }

      const files: InjectionFile[] = [];
      let totalLength = 0;

      for (const dim of SPEC_DIMENSIONS) {
        const index = await getDimensionIndex(resolvedPath, dim);

        for (const entry of index.entries) {
          // Filter by mode
          if (mode === 'required' && entry.readMode !== 'required') {
            continue;
          }

          // Filter by category if specified
          if (category && (entry.category || 'general') !== category) {
            continue;
          }

          const fileData: InjectionFile = {
            file: entry.file,
            title: entry.title,
            dimension: entry.dimension,
            category: entry.category || 'general',
            scope: entry.scope,
            readMode: entry.readMode,
            priority: entry.priority,
            contentLength: entry.contentLength || 0
          };

          // Include content if preview requested
          if (preview) {
            const filePath = join(resolvedPath, entry.file);
            if (existsSync(filePath)) {
              try {
                const rawContent = readFileSync(filePath, 'utf-8');
                const matter = (await import('gray-matter')).default;
                const parsed = matter(rawContent);
                fileData.content = parsed.content.trim();
              } catch {
                fileData.content = '';
              }
            }
          }

          files.push(fileData);
          totalLength += fileData.contentLength;
        }
      }

      // Sort by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      files.sort((a, b) =>
        (priorityOrder[a.priority as keyof typeof priorityOrder] || 2) -
        (priorityOrder[b.priority as keyof typeof priorityOrder] || 2)
      );

      // Get maxLength for percentage calculation
      let maxLength = 8000;
      const settingsPath = join(homedir(), '.claude', 'settings.json');
      if (existsSync(settingsPath)) {
        try {
          const rawSettings = readFileSync(settingsPath, 'utf-8');
          const settings = JSON.parse(rawSettings) as {
            system?: { injectionControl?: { maxLength?: number } };
          };
          maxLength = settings?.system?.injectionControl?.maxLength || 8000;
        } catch { /* ignore */ }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        files,
        stats: {
          count: files.length,
          totalLength,
          maxLength,
          percentage: Math.round((totalLength / maxLength) * 100)
        }
      }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: (err as Error).message }));
    }
    return true;
  }

  return false;
}
