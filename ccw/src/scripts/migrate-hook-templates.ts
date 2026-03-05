#!/usr/bin/env npx tsx
/**
 * Migrate Hook Templates Script
 *
 * This script helps migrate hook templates from inline bash/node commands
 * to the new `ccw hook template exec` approach, which avoids Windows Git Bash
 * quote handling issues.
 *
 * Usage:
 *   npx tsx scripts/migrate-hook-templates.ts [--dry-run] [--settings path]
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface OldHookEntry {
  matcher?: string;
  command?: string;
  _templateId?: string;
  hooks?: Array<{
    type?: string;
    command?: string;
  }>;
}

interface Settings {
  hooks?: Record<string, OldHookEntry[]>;
  [key: string]: unknown;
}

// Command patterns that indicate old-style inline scripts
const OLD_PATTERNS = [
  /bash\s+-c.*jq/,
  /node\s+-e.*child_process/,
  /node\s+-e.*spawnSync/,
  /command.*node -e ".*\{.*\}.*"/,
];

// Mapping from old patterns to new template IDs
const MIGRATION_MAP: Record<string, string> = {
  'danger-bash-confirm': 'danger-bash-confirm',
  'danger-file-protection': 'danger-file-protection',
  'danger-git-destructive': 'danger-git-destructive',
  'danger-network-confirm': 'danger-network-confirm',
  'danger-system-paths': 'danger-system-paths',
  'danger-permission-change': 'danger-permission-change',
  'memory-update-queue': 'memory-auto-compress',
  'memory-v2-extract': 'memory-v2-extract',
  'session-start-notify': 'session-start-notify',
  'stop-notify': 'stop-notify',
  'session-state-watch': 'session-state-watch',
  'auto-format-on-write': 'auto-format-on-write',
  'auto-lint-on-write': 'auto-lint-on-write',
  'block-sensitive-files': 'block-sensitive-files',
  'git-auto-stage': 'git-auto-stage',
  'post-edit-index': 'post-edit-index',
  'memory-preview-extract': 'memory-preview-extract',
  'memory-status-check': 'memory-status-check',
};

function detectTemplateFromCommand(command: string): string | null {
  for (const [pattern, templateId] of Object.entries(MIGRATION_MAP)) {
    if (command.includes(pattern)) {
      return templateId;
    }
  }

  if (command.includes('jq -r') && command.includes('DANGEROUS_PATTERNS')) {
    return 'danger-bash-confirm';
  }

  if (command.includes('localhost:3456/api/hook')) {
    if (command.includes('SESSION_CREATED')) return 'session-start-notify';
    if (command.includes('TASK_COMPLETED')) return 'stop-notify';
    if (command.includes('FILE_MODIFIED')) return 'post-edit-index';
    if (command.includes('SESSION_STATE_CHANGED')) return 'session-state-watch';
  }

  if (command.includes('prettier --write')) {
    return 'auto-format-on-write';
  }

  if (command.includes('eslint --fix')) {
    return 'auto-lint-on-write';
  }

  if (command.includes('git add -u')) {
    return 'git-auto-stage';
  }

  if (command.includes('.env') && command.includes('credential')) {
    return 'block-sensitive-files';
  }

  return null;
}

function isOldStyleHook(entry: OldHookEntry): boolean {
  const command = entry.command || entry.hooks?.[0]?.command || '';
  return OLD_PATTERNS.some(pattern => pattern.test(command));
}

function migrateHookEntry(entry: OldHookEntry, trigger: string): OldHookEntry {
  const command = entry.command || entry.hooks?.[0]?.command || '';
  const templateId = detectTemplateFromCommand(command);

  if (!templateId) {
    console.log(`  ⚠️  Could not auto-detect template for: ${command.substring(0, 50)}...`);
    return entry;
  }

  console.log(`  ✓ Migrating to template: ${templateId}`);

  return {
    _templateId: templateId,
    matcher: entry.matcher,
    hooks: [{
      type: 'command',
      command: `ccw hook template exec ${templateId} --stdin`,
    }],
  };
}

function migrateSettings(settings: Settings, dryRun: boolean): Settings {
  const migrated = { ...settings };

  if (!migrated.hooks) {
    return migrated;
  }

  console.log('\n📋 Analyzing hooks...');

  for (const [trigger, entries] of Object.entries(migrated.hooks)) {
    if (!Array.isArray(entries)) continue;

    console.log(`\n${trigger}:`);
    const newEntries: OldHookEntry[] = [];

    for (const entry of entries) {
      if (isOldStyleHook(entry)) {
        console.log(`  Found old-style hook with matcher: ${entry.matcher || '*'}`);
        const migratedEntry = migrateHookEntry(entry, trigger);
        newEntries.push(migratedEntry);
      } else {
        if (entry.hooks?.[0]?.command?.includes('ccw hook template')) {
          console.log(`  ✓ Already using template: ${(entry as OldHookEntry & { _templateId?: string })._templateId || 'unknown'}`);
        }
        newEntries.push(entry);
      }
    }

    migrated.hooks[trigger] = newEntries;
  }

  return migrated;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  let settingsPath: string;
  const settingsIndex = args.indexOf('--settings');
  if (settingsIndex >= 0 && args[settingsIndex + 1]) {
    settingsPath = args[settingsIndex + 1];
  } else {
    settingsPath = join(process.cwd(), '.claude', 'settings.json');
  }

  console.log('🔧 Hook Template Migration Script');
  console.log('='.repeat(50));
  console.log(`Settings file: ${settingsPath}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE (will modify)'}`);

  if (!existsSync(settingsPath)) {
    console.error(`\n❌ Settings file not found: ${settingsPath}`);
    process.exit(1);
  }

  let settings: Settings;
  try {
    const content = readFileSync(settingsPath, 'utf8');
    settings = JSON.parse(content);
  } catch (e) {
    console.error(`\n❌ Failed to parse settings: ${(e as Error).message}`);
    process.exit(1);
  }

  const migrated = migrateSettings(settings, dryRun);

  if (dryRun) {
    console.log('\n📄 Migrated settings (dry run):');
    console.log(JSON.stringify(migrated, null, 2));
  } else {
    const backupPath = `${settingsPath}.backup-${Date.now()}`;
    writeFileSync(backupPath, JSON.stringify(settings, null, 2));
    console.log(`\n💾 Backup saved to: ${backupPath}`);

    writeFileSync(settingsPath, JSON.stringify(migrated, null, 2));
    console.log(`\n✅ Settings migrated successfully!`);
  }

  console.log('\n📌 Next steps:');
  console.log('  1. Review the migrated settings');
  console.log('  2. Test your hooks to ensure they work correctly');
  console.log('  3. Run "ccw hook template list" to see all available templates');
}

main().catch(console.error);
