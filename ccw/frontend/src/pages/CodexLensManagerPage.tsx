// ========================================
// CodexLens Manager Page
// ========================================
// Manage CodexLens semantic code search with tabbed interface
// Supports Overview, Settings, Models, and Advanced tabs

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Sparkles,
  RefreshCw,
  Download,
  Trash2,
  Zap,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/AlertDialog';
import { OverviewTab } from '@/components/codexlens/OverviewTab';
import { SettingsTab } from '@/components/codexlens/SettingsTab';
import { AdvancedTab } from '@/components/codexlens/AdvancedTab';
import { GpuSelector } from '@/components/codexlens/GpuSelector';
import { ModelsTab } from '@/components/codexlens/ModelsTab';
import { SearchTab } from '@/components/codexlens/SearchTab';
import { SemanticInstallDialog } from '@/components/codexlens/SemanticInstallDialog';
import { useCodexLensDashboard, useCodexLensMutations } from '@/hooks';
import { cn } from '@/lib/utils';

export function CodexLensManagerPage() {
  const { formatMessage } = useIntl();
  const [activeTab, setActiveTab] = useState('overview');
  const [isUninstallDialogOpen, setIsUninstallDialogOpen] = useState(false);
  const [isSemanticInstallOpen, setIsSemanticInstallOpen] = useState(false);

  const {
    installed,
    status,
    config,
    semantic,
    isLoading,
    isFetching,
    refetch,
  } = useCodexLensDashboard();

  const {
    bootstrap,
    isBootstrapping,
    uninstall,
    isUninstalling,
  } = useCodexLensMutations();

  const handleRefresh = () => {
    refetch();
  };

  const handleBootstrap = async () => {
    const result = await bootstrap();
    if (result.success) {
      refetch();
    }
  };

  const handleUninstall = async () => {
    const result = await uninstall();
    if (result.success) {
      refetch();
    }
    setIsUninstallDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            {formatMessage({ id: 'codexlens.title' })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatMessage({ id: 'codexlens.description' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={isFetching}
          >
            <RefreshCw className={cn('w-4 h-4 mr-2', isFetching && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
          {!installed ? (
            <Button
              onClick={handleBootstrap}
              disabled={isBootstrapping}
            >
              <Download className={cn('w-4 h-4 mr-2', isBootstrapping && 'animate-spin')} />
              {isBootstrapping
                ? formatMessage({ id: 'codexlens.bootstrapping' })
                : formatMessage({ id: 'codexlens.bootstrap' })
              }
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setIsSemanticInstallOpen(true)}
                disabled={!semantic?.available}
              >
                <Zap className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'codexlens.semantic.install' })}
              </Button>
              <AlertDialog open={isUninstallDialogOpen} onOpenChange={setIsUninstallDialogOpen}>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="destructive"
                    disabled={isUninstalling}
                  >
                    <Trash2 className={cn('w-4 h-4 mr-2', isUninstalling && 'animate-spin')} />
                    {isUninstalling
                      ? formatMessage({ id: 'codexlens.uninstalling' })
                      : formatMessage({ id: 'codexlens.uninstall' })
                    }
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>
                      {formatMessage({ id: 'codexlens.confirmUninstallTitle' })}
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      {formatMessage({ id: 'codexlens.confirmUninstall' })}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isUninstalling}>
                      {formatMessage({ id: 'common.actions.cancel' })}
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleUninstall}
                      disabled={isUninstalling}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isUninstalling
                        ? formatMessage({ id: 'codexlens.uninstalling' })
                        : formatMessage({ id: 'common.actions.confirm' })
                      }
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          )}
        </div>
      </div>

      {/* Installation Status Alert */}
      {!installed && !isLoading && (
        <Card className="p-4 bg-warning/10 border-warning/20">
          <p className="text-sm text-warning-foreground">
            {formatMessage({ id: 'codexlens.notInstalled' })}
          </p>
        </Card>
      )}

      {/* Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            {formatMessage({ id: 'codexlens.tabs.overview' })}
          </TabsTrigger>
          <TabsTrigger value="settings">
            {formatMessage({ id: 'codexlens.tabs.settings' })}
          </TabsTrigger>
          <TabsTrigger value="models">
            {formatMessage({ id: 'codexlens.tabs.models' })}
          </TabsTrigger>
          <TabsTrigger value="search">
            {formatMessage({ id: 'codexlens.tabs.search' })}
          </TabsTrigger>
          <TabsTrigger value="advanced">
            {formatMessage({ id: 'codexlens.tabs.advanced' })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            installed={installed}
            status={status}
            config={config}
            isLoading={isLoading}
            onRefresh={handleRefresh}
          />
        </TabsContent>

        <TabsContent value="settings">
          <SettingsTab enabled={installed} />
        </TabsContent>

        <TabsContent value="models">
          <ModelsTab installed={installed} />
        </TabsContent>

        <TabsContent value="search">
          <SearchTab enabled={installed} />
        </TabsContent>

        <TabsContent value="advanced">
          <AdvancedTab enabled={installed} />
        </TabsContent>
      </Tabs>

      {/* Semantic Install Dialog */}
      <SemanticInstallDialog
        open={isSemanticInstallOpen}
        onOpenChange={setIsSemanticInstallOpen}
        onSuccess={() => refetch()}
      />
    </div>
  );
}

export default CodexLensManagerPage;
