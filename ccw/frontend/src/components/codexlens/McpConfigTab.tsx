// ========================================
// McpConfigTab Component
// ========================================
// Read-only MCP config JSON display with copy-to-clipboard and regenerate

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Copy, RefreshCw, Check, Download, Loader2 } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCodexLensMcpConfig, useCodexLensEnv } from '@/hooks/useCodexLens';
import { addGlobalMcpServer, copyMcpServerToProject } from '@/lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';

export function McpConfigTab() {
  const { formatMessage } = useIntl();
  const { data: mcpConfig, isLoading, isError, refetch } = useCodexLensMcpConfig();
  const { data: envData } = useCodexLensEnv();
  const [copied, setCopied] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [installResult, setInstallResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const projectPath = useWorkflowStore(selectProjectPath);

  const handleInstall = async (scope: 'global' | 'project') => {
    setInstalling(true);
    setInstallResult(null);
    try {
      const mcpServers = mcpConfig?.['mcpServers'];
      const serverConfig = mcpServers && typeof mcpServers === 'object'
        ? (mcpServers as Record<string, unknown>).codexlens
        : undefined;

      if (!serverConfig || typeof serverConfig !== 'object') {
        throw new Error(formatMessage({ id: 'codexlens.mcp.noConfig' }));
      }

      const typedConfig = serverConfig as {
        command: string;
        args?: string[];
        env?: Record<string, string>;
        type?: string;
      };

      if (scope === 'project') {
        if (!projectPath) {
          throw new Error(formatMessage({ id: 'codexlens.mcp.installError' }));
        }
        await copyMcpServerToProject('codexlens', typedConfig, projectPath);
      } else {
        await addGlobalMcpServer('codexlens', typedConfig);
      }

      setInstallResult({
        ok: true,
        msg: formatMessage({ id: 'codexlens.mcp.installSuccess' }),
      });
    } catch (err) {
      setInstallResult({ ok: false, msg: (err as Error).message });
    } finally {
      setInstalling(false);
    }
  };

  const hasApiUrl = !!(envData?.values.CODEXLENS_EMBED_API_URL);
  const embedMode = hasApiUrl ? 'API' : 'Local fastembed';

  const configJson = mcpConfig ? JSON.stringify(mcpConfig, null, 2) : '';

  const handleCopy = () => {
    navigator.clipboard.writeText(configJson).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleRegenerate = () => {
    refetch();
  };

  return (
    <div className="space-y-4">
      {/* Embed mode badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{formatMessage({ id: 'codexlens.mcp.embedMode' })}:</span>
        <Badge variant={hasApiUrl ? 'success' : 'secondary'}>
          {embedMode}
        </Badge>
      </div>

      {/* Config JSON block */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{formatMessage({ id: 'codexlens.mcp.configTitle' })}</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                disabled={!configJson || isLoading}
              >
                {copied ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                {copied ? formatMessage({ id: 'codexlens.mcp.copied' }) : formatMessage({ id: 'codexlens.mcp.copy' })}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRegenerate}
                disabled={isLoading}
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                {formatMessage({ id: 'codexlens.mcp.regenerate' })}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <p className="text-sm text-muted-foreground">{formatMessage({ id: 'codexlens.mcp.loading' })}</p>
          )}
          {isError && (
            <p className="text-sm text-destructive">{formatMessage({ id: 'codexlens.mcp.error' })}</p>
          )}
          {!isLoading && !isError && (
            <pre className="bg-muted rounded-md p-4 text-xs overflow-auto max-h-96 font-mono">
              {configJson || formatMessage({ id: 'codexlens.mcp.noConfig' })}
            </pre>
          )}
        </CardContent>
      </Card>

      {/* Quick Install */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{formatMessage({ id: 'codexlens.mcp.quickInstallTitle' })}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{formatMessage({ id: 'codexlens.mcp.quickInstallDesc' })}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleInstall('project')}
              disabled={installing || !projectPath}
            >
              {installing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              {installing ? formatMessage({ id: 'codexlens.mcp.installing' }) : formatMessage({ id: 'codexlens.mcp.installProject' })}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleInstall('global')}
              disabled={installing}
            >
              {installing ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Download className="w-4 h-4 mr-1" />}
              {installing ? formatMessage({ id: 'codexlens.mcp.installing' }) : formatMessage({ id: 'codexlens.mcp.installGlobal' })}
            </Button>
          </div>
          {installResult && (
            <p className={`text-sm ${installResult.ok ? 'text-success' : 'text-destructive'}`}>
              {installResult.msg}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Installation instructions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{formatMessage({ id: 'codexlens.mcp.installTitle' })}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>{formatMessage({ id: 'codexlens.mcp.installSteps.step1' })}</li>
            <li>{formatMessage({ id: 'codexlens.mcp.installSteps.step2' })}</li>
            <li>{formatMessage({ id: 'codexlens.mcp.installSteps.step3' })}</li>
            <li>{formatMessage({ id: 'codexlens.mcp.installSteps.step4' })}</li>
            <li>{formatMessage({ id: 'codexlens.mcp.installSteps.step5' })}</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
