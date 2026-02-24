import path from 'path';

export type CliSessionShellKind = 'wsl-bash' | 'git-bash' | 'pwsh' | 'cmd';

export type CliSessionResumeStrategy = 'nativeResume' | 'promptConcat';

export interface CliSessionExecuteCommandInput {
  projectRoot: string;
  shellKind: CliSessionShellKind;
  tool: string;
  prompt: string;
  mode?: 'analysis' | 'write' | 'auto';
  model?: string;
  workingDir?: string;
  category?: 'user' | 'internal' | 'insight';
  resumeStrategy?: CliSessionResumeStrategy;
  prevExecutionId?: string;
  executionId: string;
}

export interface CliSessionExecuteCommandOutput {
  command: string;
}

function toPosixPath(p: string): string {
  return p.replace(/\\/g, '/');
}

function toWslPath(winPath: string): string {
  const normalized = winPath.replace(/\\/g, '/').replace(/\/+/g, '/');
  const driveMatch = normalized.match(/^([a-zA-Z]):\/(.*)$/);
  if (!driveMatch) return normalized;
  return `/mnt/${driveMatch[1].toLowerCase()}/${driveMatch[2]}`;
}

function escapeArg(value: string): string {
  // Minimal quoting that works in pwsh + bash.
  // We intentionally avoid escaping with platform-specific rules; values are expected to be simple (paths/tool/model).
  if (!value) return '""';
  if (/[\s"]/g.test(value)) {
    return `"${value.replaceAll('"', '\\"')}"`;
  }
  return value;
}

export function buildCliSessionExecuteCommand(input: CliSessionExecuteCommandInput): CliSessionExecuteCommandOutput {
  const {
    projectRoot,
    shellKind,
    tool,
    prompt,
    mode = 'analysis',
    model,
    workingDir,
    category = 'user',
    resumeStrategy = 'nativeResume',
    prevExecutionId,
    executionId
  } = input;

  const nodeExe = shellKind === 'wsl-bash' ? 'node.exe' : 'node';

  const ccwScriptWin = path.join(projectRoot, 'ccw', 'bin', 'ccw.js');
  const ccwScriptPosix = toPosixPath(ccwScriptWin);
  const ccwScriptWsl = toWslPath(ccwScriptPosix);

  // In WSL we prefer running the Windows Node (`node.exe`) for compatibility
  // (no dependency on Node being installed inside the Linux distro). However,
  // Windows executables do not reliably understand `/mnt/*` paths, so we convert
  // to Windows paths at runtime via `wslpath -w`.
  const wslPreambleParts: string[] = [];
  if (shellKind === 'wsl-bash') {
    wslPreambleParts.push(`CCW_WIN=$(wslpath -w ${escapeArg(ccwScriptWsl)})`);
    if (workingDir) {
      const wdWsl = toWslPath(toPosixPath(workingDir));
      wslPreambleParts.push(`WD_WIN=$(wslpath -w ${escapeArg(wdWsl)})`);
    }
  }
  const wslPreamble = wslPreambleParts.length > 0 ? `${wslPreambleParts.join('; ')}; ` : '';

  const cdArg =
    workingDir
      ? shellKind === 'wsl-bash'
        ? ' --cd "$WD_WIN"'
        : ` --cd ${escapeArg(toPosixPath(workingDir))}`
      : '';
  const modelArg = model ? ` --model ${escapeArg(model)}` : '';
  const resumeArg = prevExecutionId ? ` --resume ${escapeArg(prevExecutionId)}` : '';
  const noNativeArg = resumeStrategy === 'promptConcat' ? ' --no-native' : '';

  // Pipe prompt through stdin so multi-line works without shell-dependent quoting.
  // Base64 avoids escaping issues; decode is performed by node itself.
  const promptB64 = Buffer.from(prompt, 'utf8').toString('base64');
  const decodeCmd = `${nodeExe} -e "process.stdout.write(Buffer.from('${promptB64}','base64'))"`;

  const ccwTarget = shellKind === 'wsl-bash' ? '"$CCW_WIN"' : escapeArg(ccwScriptPosix);
  const ccwCmd =
    `${nodeExe} ${ccwTarget} cli` +
    ` --tool ${escapeArg(tool)}` +
    ` --mode ${escapeArg(mode)}` +
    `${modelArg}` +
    `${cdArg}` +
    ` --category ${escapeArg(category)}` +
    ` --stream` +
    ` --id ${escapeArg(executionId)}` +
    `${resumeArg}` +
    `${noNativeArg}`;

  return { command: `${wslPreamble}${decodeCmd} | ${ccwCmd}` };
}
