import { describe, it, expect } from 'vitest';
import { detectCcArtifacts } from './ccw-artifacts';

describe('ccw-artifacts', () => {
  it('returns empty array for empty input', () => {
    expect(detectCcArtifacts('')).toEqual([]);
  });

  it('detects workflow session artifacts', () => {
    const text = 'Created: (.workflow/active/WFS-demo/workflow-session.json)';
    expect(detectCcArtifacts(text)).toEqual([
      { type: 'workflow-session', path: '.workflow/active/WFS-demo/workflow-session.json' },
    ]);
  });

  it('detects lite session artifacts', () => {
    const text = 'Plan: .workflow/.lite-plan/terminal-dashboard-enhancement-2026-02-15/plan.json';
    expect(detectCcArtifacts(text)).toEqual([
      { type: 'lite-session', path: '.workflow/.lite-plan/terminal-dashboard-enhancement-2026-02-15/plan.json' },
    ]);
  });

  it('detects CLAUDE.md artifacts (case-insensitive)', () => {
    const text = 'Updated: /repo/docs/claude.md and also CLAUDE.md';
    const res = detectCcArtifacts(text);
    expect(res).toEqual([
      { type: 'claude-md', path: '/repo/docs/claude.md' },
      { type: 'claude-md', path: 'CLAUDE.md' },
    ]);
  });

  it('detects CCW config artifacts', () => {
    const text = 'Config: .ccw/config.toml and ccw.config.yaml';
    expect(detectCcArtifacts(text)).toEqual([
      { type: 'ccw-config', path: '.ccw/config.toml' },
      { type: 'ccw-config', path: 'ccw.config.yaml' },
    ]);
  });

  it('detects issue artifacts', () => {
    const text = 'Queue: .workflow/issues/queues/index.json';
    expect(detectCcArtifacts(text)).toEqual([
      { type: 'issue', path: '.workflow/issues/queues/index.json' },
    ]);
  });

  it('deduplicates repeated artifacts', () => {
    const text = '.workflow/issues/issues.jsonl ... .workflow/issues/issues.jsonl';
    expect(detectCcArtifacts(text)).toEqual([
      { type: 'issue', path: '.workflow/issues/issues.jsonl' },
    ]);
  });

  it('preserves discovery order across types', () => {
    const text = [
      'Issue: .workflow/issues/issues.jsonl',
      'Then plan: .workflow/.lite-plan/abc/plan.json',
      'Then session: .workflow/active/WFS-x/workflow-session.json',
      'Then config: .ccw/config.toml',
      'Then CLAUDE: CLAUDE.md',
    ].join(' | ');

    const res = detectCcArtifacts(text);
    expect(res.map((a) => a.type)).toEqual([
      'issue',
      'lite-session',
      'workflow-session',
      'ccw-config',
      'claude-md',
    ]);
  });
});

