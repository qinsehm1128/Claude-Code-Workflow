// ========================================
// Recommended MCP Section Component
// ========================================
// Display recommended MCP servers with wizard-based install functionality

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  Search,
  Globe,
  Sparkles,
  Download,
  Settings,
  Key,
  Zap,
  Code2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { RecommendedMcpWizard, RecommendedMcpDefinition } from './RecommendedMcpWizard';
import { fetchMcpConfig } from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Types ==========

/**
 * Props for RecommendedMcpSection component
 */
export interface RecommendedMcpSectionProps {
  /** Callback when server is installed */
  onInstallComplete?: () => void;
}

// ========== Platform Detection ==========
const isWindows = typeof navigator !== 'undefined' && navigator.platform?.toLowerCase().includes('win');

/**
 * Build cross-platform MCP config
 * On Windows, wraps npx/node/python commands with cmd /c for proper execution
 */
function buildCrossPlatformMcpConfig(
  command: string,
  args: string[] = [],
  options: { env?: Record<string, string>; type?: string } = {}
) {
  const { env, type } = options;

  const windowsWrappedCommands = ['npx', 'npm', 'node', 'python', 'python3', 'pip', 'pip3', 'pnpm', 'yarn', 'bun'];
  const needsWindowsWrapper = isWindows && windowsWrappedCommands.includes(command.toLowerCase());

  const config: { command: string; args: string[]; env?: Record<string, string>; type?: string } = needsWindowsWrapper
    ? { command: 'cmd', args: ['/c', command, ...args] }
    : { command, args };

  if (type) config.type = type;
  if (env && Object.keys(env).length > 0) config.env = env;

  return config;
}

// ========== Recommended MCP Definitions ==========

/**
 * Pre-configured recommended MCP servers with field definitions
 * Matches original JS version structure for full wizard support
 */
const RECOMMENDED_MCP_DEFINITIONS: RecommendedMcpDefinition[] = [
  {
    id: 'ace-tool',
    nameKey: 'mcp.ace-tool.name',
    descKey: 'mcp.ace-tool.desc',
    icon: 'search-code',
    category: 'search',
    fields: [
      {
        key: 'baseUrl',
        labelKey: 'mcp.ace-tool.field.baseUrl',
        type: 'text',
        default: 'https://acemcp.heroman.wtf/relay/',
        placeholder: 'https://acemcp.heroman.wtf/relay/',
        required: true,
        descKey: 'mcp.ace-tool.field.baseUrl.desc',
      },
      {
        key: 'token',
        labelKey: 'mcp.ace-tool.field.token',
        type: 'password',
        default: '',
        placeholder: 'ace_xxxxxxxxxxxxxxxx',
        required: true,
        descKey: 'mcp.ace-tool.field.token.desc',
      },
    ],
    buildConfig: (values) => buildCrossPlatformMcpConfig('npx', [
      'ace-tool',
      '--base-url',
      values.baseUrl || 'https://acemcp.heroman.wtf/relay/',
      '--token',
      values.token,
    ]),
  },
  {
    id: 'chrome-devtools',
    nameKey: 'mcp.chrome-devtools.name',
    descKey: 'mcp.chrome-devtools.desc',
    icon: 'chrome',
    category: 'browser',
    fields: [],
    buildConfig: () => buildCrossPlatformMcpConfig('npx', ['chrome-devtools-mcp@latest'], { type: 'stdio' }),
  },
  {
    id: 'exa',
    nameKey: 'mcp.exa.name',
    descKey: 'mcp.exa.desc',
    icon: 'globe-2',
    category: 'search',
    fields: [
      {
        key: 'apiKey',
        labelKey: 'mcp.exa.field.apiKey',
        type: 'password',
        default: '',
        placeholder: 'your-exa-api-key',
        required: false,
        descKey: 'mcp.exa.field.apiKey.desc',
      },
    ],
    buildConfig: (values) => {
      const env = values.apiKey ? { EXA_API_KEY: values.apiKey } : undefined;
      return buildCrossPlatformMcpConfig('npx', ['-y', 'exa-mcp-server'], { env });
    },
  },
];

// ========== Icon Map ==========

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'search-code': Search,
  'chrome': Globe,
  'globe-2': Sparkles,
  'code-2': Code2,
};

// ========== Helper Component ==========

interface RecommendedServerCardProps {
  definition: RecommendedMcpDefinition;
  isInstalled: boolean;
  onInstall: (definition: RecommendedMcpDefinition) => void;
}

/**
 * Individual recommended server card
 */
function RecommendedServerCard({
  definition,
  isInstalled,
  onInstall,
}: RecommendedServerCardProps) {
  const { formatMessage } = useIntl();
  const Icon = ICON_MAP[definition.icon] || Settings;
  const hasFields = definition.fields.length > 0;

  return (
    <Card className="p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          'p-2.5 rounded-lg',
          isInstalled ? 'bg-primary/20' : 'bg-muted'
        )}>
          <Icon className={cn(
            'w-5 h-5',
            isInstalled ? 'text-primary' : 'text-muted-foreground'
          )} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="text-sm font-medium text-foreground truncate">
              {formatMessage({ id: definition.nameKey })}
            </h4>
            {isInstalled && (
              <Badge variant="default" className="text-xs">
                {formatMessage({ id: 'mcp.recommended.actions.installed' })}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
            {formatMessage({ id: definition.descKey })}
          </p>

          {/* Config info + Install */}
          <div className="flex items-center justify-between">
            {hasFields ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Key className="w-3 h-3" />
                {definition.fields.length} {formatMessage({ id: 'mcp.configRequired' })}
              </span>
            ) : (
              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                {formatMessage({ id: 'mcp.noConfigNeeded' })}
              </span>
            )}
            <Button
              variant={isInstalled ? 'outline' : 'default'}
              size="sm"
              onClick={() => onInstall(definition)}
            >
              {isInstalled ? (
                <>
                  <Settings className="w-3.5 h-3.5 mr-1" />
                  {formatMessage({ id: 'mcp.reconfigure' })}
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 mr-1" />
                  {formatMessage({ id: 'mcp.recommended.actions.install' })}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ========== Main Component ==========

/**
 * Recommended MCP servers section with wizard-based install
 */
export function RecommendedMcpSection({
  onInstallComplete,
}: RecommendedMcpSectionProps) {
  const { formatMessage } = useIntl();

  const [wizardOpen, setWizardOpen] = useState(false);
  const [selectedDefinition, setSelectedDefinition] = useState<RecommendedMcpDefinition | null>(null);
  const [installedServerIds, setInstalledServerIds] = useState<Set<string>>(new Set());

  // Check which servers are already installed
  const checkInstalledServers = async () => {
    try {
      const data = await fetchMcpConfig();
      const installedIds = new Set<string>();

      const globalServers = data.globalServers || {};
      const userServers = data.userServers || {};
      for (const name of Object.keys(globalServers)) installedIds.add(name);
      for (const name of Object.keys(userServers)) installedIds.add(name);

      const projects = data.projects || {};
      for (const proj of Object.values(projects)) {
        const servers = (proj as any).mcpServers || {};
        for (const name of Object.keys(servers)) installedIds.add(name);
      }

      if ((data as any).codex?.servers) {
        for (const name of Object.keys((data as any).codex.servers)) installedIds.add(name);
      }

      setInstalledServerIds(installedIds);
    } catch {
      // Ignore errors during check
    }
  };

  useEffect(() => {
    checkInstalledServers();
  }, []);

  // Handle install click - open wizard
  const handleInstallClick = (definition: RecommendedMcpDefinition) => {
    setSelectedDefinition(definition);
    setWizardOpen(true);
  };

  // Handle wizard close
  const handleWizardClose = () => {
    setWizardOpen(false);
    setSelectedDefinition(null);
  };

  // Handle install complete
  const handleInstallComplete = () => {
    checkInstalledServers();
    onInstallComplete?.();
  };

  return (
    <>
      <section className="space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {formatMessage({ id: 'mcp.recommended.title' })}
          </h2>
          <p className="text-sm text-muted-foreground">
            {formatMessage({ id: 'mcp.recommended.description' })}
          </p>
        </div>

        {/* Server Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {RECOMMENDED_MCP_DEFINITIONS.map((definition) => (
            <RecommendedServerCard
              key={definition.id}
              definition={definition}
              isInstalled={installedServerIds.has(definition.id)}
              onInstall={handleInstallClick}
            />
          ))}
        </div>
      </section>

      {/* Wizard Dialog */}
      <RecommendedMcpWizard
        open={wizardOpen}
        onClose={handleWizardClose}
        mcpDefinition={selectedDefinition}
        onInstallComplete={handleInstallComplete}
      />
    </>
  );
}

export default RecommendedMcpSection;
