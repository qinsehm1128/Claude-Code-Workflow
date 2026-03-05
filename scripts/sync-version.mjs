#!/usr/bin/env node
/**
 * 版本同步脚本
 * 用法:
 *   node scripts/sync-version.mjs           # 检查版本状态
 *   node scripts/sync-version.mjs --sync    # 同步到最新 npm 版本
 *   node scripts/sync-version.mjs --tag     # 创建对应 git tag
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const packagePath = join(rootDir, 'package.json');

function run(cmd, silent = false) {
  try {
    return execSync(cmd, { cwd: rootDir, encoding: 'utf-8', stdio: silent ? 'pipe' : 'inherit' });
  } catch (e) {
    if (!silent) console.error(`Command failed: ${cmd}`);
    return null;
  }
}

function runSilent(cmd) {
  try {
    return execSync(cmd, { cwd: rootDir, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
}

function getLocalVersion() {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
  return pkg.version;
}

function getNpmVersion() {
  const result = runSilent('npm view claude-code-workflow version');
  return result;
}

function getLatestTag() {
  const result = runSilent('git describe --tags --abbrev=0 2>/dev/null');
  return result ? result.replace(/^v/, '') : null;
}

function setLocalVersion(version) {
  const pkg = JSON.parse(readFileSync(packagePath, 'utf-8'));
  pkg.version = version;
  writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`✅ Updated package.json to ${version}`);
}

function createTag(version) {
  const tagName = `v${version}`;
  run(`git tag -a ${tagName} -m "Release ${tagName}"`);
  console.log(`✅ Created tag ${tagName}`);
  console.log('💡 Run `git push origin ${tagName}` to push the tag');
}

const args = process.argv.slice(2);
const shouldSync = args.includes('--sync');
const shouldTag = args.includes('--tag');

console.log('📦 Version Status\n');

const localVersion = getLocalVersion();
const npmVersion = getNpmVersion();
const tagVersion = getLatestTag();

console.log(`  Local (package.json):  ${localVersion}`);
console.log(`  NPM (latest):          ${npmVersion || 'not published'}`);
console.log(`  GitHub Tag (latest):   ${tagVersion || 'no tags'}`);
console.log('');

const allVersions = [localVersion, npmVersion, tagVersion].filter(Boolean);
const allMatch = allVersions.every(v => v === allVersions[0]);

if (allMatch) {
  console.log('✅ All versions are in sync!\n');
} else {
  console.log('⚠️  Versions are out of sync!\n');

  if (shouldSync && npmVersion) {
    console.log(`Syncing to npm version: ${npmVersion}`);
    setLocalVersion(npmVersion);
  } else if (!shouldSync) {
    console.log('💡 Run with --sync to sync local version to npm');
  }
}

if (shouldTag && localVersion) {
  const currentTag = `v${localVersion}`;
  const existingTags = runSilent('git tag -l ' + currentTag);

  if (existingTags) {
    console.log(`⚠️  Tag ${currentTag} already exists`);
  } else {
    createTag(localVersion);
  }
}

if (!shouldSync && !shouldTag && !allMatch) {
  console.log('Suggested actions:');
  if (npmVersion && localVersion !== npmVersion) {
    console.log(`  node scripts/sync-version.mjs --sync    # Sync to npm ${npmVersion}`);
  }
  if (tagVersion !== localVersion) {
    console.log(`  node scripts/sync-version.mjs --tag    # Create tag v${localVersion}`);
  }
}
