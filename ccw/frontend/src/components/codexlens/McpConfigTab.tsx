// ========================================
// McpConfigTab Component
// ========================================
// Read-only MCP config JSON display with copy-to-clipboard and regenerate

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Copy, RefreshCw, Check } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useCodexLensMcpConfig, useCodexLensEnv } from '@/hooks/useCodexLens';

export function McpConfigTab() {
  const { formatMessage } = useIntl();
  const { data: mcpConfig, isLoading, isError, refetch } = useCodexLensMcpConfig();
  const { data: envData } = useCodexLensEnv();
  const [copied, setCopied] = useState(false);

  const hasApiUrl = !!(envData?.CODEXLENS_EMBED_API_URL);
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
