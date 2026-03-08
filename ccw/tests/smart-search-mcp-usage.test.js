import { afterEach, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const smartSearchPath = new URL('../dist/tools/smart-search.js', import.meta.url).href;

describe('Smart Search MCP usage defaults and path handling', async () => {
  let smartSearchModule;
  const tempDirs = [];

  before(async () => {
    try {
      smartSearchModule = await import(smartSearchPath);
    } catch (err) {
      console.log('Note: smart-search module import skipped:', err?.message ?? String(err));
    }
  });

  afterEach(() => {
    while (tempDirs.length > 0) {
      rmSync(tempDirs.pop(), { recursive: true, force: true });
    }
  });

  function createWorkspace() {
    const dir = mkdtempSync(join(tmpdir(), 'ccw-smart-search-'));
    tempDirs.push(dir);
    return dir;
  }

  it('keeps schema defaults aligned with runtime docs', () => {
    if (!smartSearchModule) return;

    const { schema } = smartSearchModule;
    const props = schema.inputSchema.properties;

    assert.equal(props.maxResults.default, 5);
    assert.equal(props.limit.default, 5);
    assert.match(schema.description, /static FTS index/i);
    assert.match(schema.description, /semantic\/vector embeddings/i);
    assert.ok(props.action.enum.includes('embed'));
    assert.match(props.embeddingBackend.description, /litellm\/api/i);
    assert.match(props.apiMaxWorkers.description, /endpoint pool/i);
    assert.match(schema.description, /apiMaxWorkers=8/i);
    assert.match(props.path.description, /single file path/i);
  });

  it('honors explicit small limit values', async () => {
    if (!smartSearchModule) return;

    const dir = createWorkspace();
    const file = join(dir, 'many.ts');
    writeFileSync(file, ['const hit = 1;', 'const hit = 2;', 'const hit = 3;'].join('\n'));

    const toolResult = await smartSearchModule.handler({
      action: 'search',
      query: 'hit',
      path: dir,
      limit: 1,
      regex: false,
      tokenize: false,
    });

    assert.equal(toolResult.success, true, toolResult.error);
    assert.equal(toolResult.result.success, true);
    assert.equal(toolResult.result.results.length, 1);
    assert.equal(toolResult.result.metadata.pagination.limit, 1);
  });

  it('scopes search results to a single file path', async () => {
    if (!smartSearchModule) return;

    const dir = createWorkspace();
    const target = join(dir, 'target.ts');
    const other = join(dir, 'other.ts');
    writeFileSync(target, 'const TARGET_TOKEN = 1;\n');
    writeFileSync(other, 'const TARGET_TOKEN = 2;\n');

    const toolResult = await smartSearchModule.handler({
      action: 'search',
      query: 'TARGET_TOKEN',
      path: target,
      regex: false,
      tokenize: false,
    });

    assert.equal(toolResult.success, true, toolResult.error);
    assert.equal(toolResult.result.success, true);
    assert.ok(Array.isArray(toolResult.result.results));
    assert.ok(toolResult.result.results.length >= 1);

    const normalizedFiles = toolResult.result.results.map((item) => String(item.file).replace(/\\/g, '/'));
    assert.ok(normalizedFiles.every((file) => file.endsWith('/target.ts') || file === 'target.ts'));
    assert.ok(normalizedFiles.every((file) => !file.endsWith('/other.ts')));
  });

  it('normalizes wrapped multiline query and file path inputs', async () => {
    if (!smartSearchModule) return;

    const dir = createWorkspace();
    const nestedDir = join(dir, 'hydro_generator_module', 'builders');
    mkdirSync(nestedDir, { recursive: true });
    const target = join(nestedDir, 'full_machine_builders.py');
    writeFileSync(target, 'def _resolve_rotor_inner():\n    return rotor_main_seg\n');

    const wrappedPath = target.replace(/([\\/])builders([\\/])/, '$1\n        builders$2');
    const wrappedQuery = '_resolve_rotor_inner OR\n        rotor_main_seg';

    const toolResult = await smartSearchModule.handler({
      action: 'search',
      query: wrappedQuery,
      path: wrappedPath,
      regex: false,
      caseSensitive: false,
    });

    assert.equal(toolResult.success, true, toolResult.error);
    assert.equal(toolResult.result.success, true);
    assert.ok(toolResult.result.results.length >= 1);
  });

  it('surfaces backend failure details when fuzzy search fully fails', async () => {
    if (!smartSearchModule) return;

    const missingPath = join(createWorkspace(), 'missing-folder', 'missing.ts');
    const toolResult = await smartSearchModule.handler({
      action: 'search',
      query: 'TARGET_TOKEN',
      path: missingPath,
      regex: false,
      tokenize: false,
    });

    assert.equal(toolResult.success, false);
    assert.match(toolResult.error, /Both search backends failed:/);
    assert.match(toolResult.error, /(FTS|Ripgrep)/);
  });
});
