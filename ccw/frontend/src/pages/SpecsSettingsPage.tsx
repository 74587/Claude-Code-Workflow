/**
 * Specs Settings Page
 *
 * Main page for managing spec settings, hooks, injection control, and global settings.
 * Uses 5 tabs: Project Specs | Personal Specs | Hooks | Injection | Settings
 */
import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollText, User, Plug, Gauge, Settings, RefreshCw, Search } from 'lucide-react';
import { SpecCard, SpecDialog, type Spec, type SpecFormData } from '@/components/specs';
import { HookCard, HookDialog, type HookConfig } from '@/components/specs';
import { InjectionControlTab } from '@/components/specs/InjectionControlTab';
import { GlobalSettingsTab } from '@/components/specs/GlobalSettingsTab';
import { useSpecStats } from '@/hooks/useSystemSettings';

type SettingsTab = 'project-specs' | 'personal-specs' | 'hooks' | 'injection' | 'settings';

export function SpecsSettingsPage() {
  const { formatMessage } = useIntl();
  const [activeTab, setActiveTab] = useState<SettingsTab>('project-specs');
  const [searchQuery, setSearchQuery] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [hookDialogOpen, setHookDialogOpen] = useState(false);
  const [editingSpec, setEditingSpec] = useState<Spec | null>(null);
  const [editingHook, setEditingHook] = useState<HookConfig | null>(null);

  // Mock data for demonstration - will be replaced with real API calls
  const [projectSpecs] = useState<Spec[]>([]);
  const [personalSpecs] = useState<Spec[]>([]);
  const [hooks] = useState<HookConfig[]>([]);
  const [isLoading] = useState(false);

  const { data: statsData, refetch: refetchStats } = useSpecStats();

  const handleSpecEdit = (spec: Spec) => {
    setEditingSpec(spec);
    setEditDialogOpen(true);
  };

  const handleSpecSave = async (specId: string, data: SpecFormData) => {
    console.log('Saving spec:', specId, data);
    // TODO: Implement save logic
    setEditDialogOpen(false);
  };

  const handleSpecToggle = async (specId: string, enabled: boolean) => {
    console.log('Toggling spec:', specId, enabled);
    // TODO: Implement toggle logic
  };

  const handleSpecDelete = async (specId: string) => {
    console.log('Deleting spec:', specId);
    // TODO: Implement delete logic
  };

  const handleHookEdit = (hook: HookConfig) => {
    setEditingHook(hook);
    setHookDialogOpen(true);
  };

  const handleHookSave = async (hookId: string | null, data: Partial<HookConfig>) => {
    console.log('Saving hook:', hookId, data);
    // TODO: Implement save logic
    setHookDialogOpen(false);
  };

  const handleHookToggle = async (hookId: string, enabled: boolean) => {
    console.log('Toggling hook:', hookId, enabled);
    // TODO: Implement toggle logic
  };

  const handleHookDelete = async (hookId: string) => {
    console.log('Deleting hook:', hookId);
    // TODO: Implement delete logic
  };

  const handleRebuildIndex = async () => {
    console.log('Rebuilding index...');
    // TODO: Implement rebuild logic
  };

  const filterSpecs = (specs: Spec[]) => {
    if (!searchQuery.trim()) return specs;
    const query = searchQuery.toLowerCase();
    return specs.filter(spec =>
      spec.title.toLowerCase().includes(query) ||
      spec.keywords.some(k => k.toLowerCase().includes(query))
    );
  };

  const renderSpecsTab = (dimension: 'project' | 'personal') => {
    const specs = dimension === 'project' ? projectSpecs : personalSpecs;
    const filteredSpecs = filterSpecs(specs);

    return (
      <div className="space-y-4">
        {/* Search and Actions */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={formatMessage({ id: 'specs.searchPlaceholder', defaultMessage: 'Search specs...' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={handleRebuildIndex}>
            <RefreshCw className="h-4 w-4 mr-2" />
            {formatMessage({ id: 'specs.rebuildIndex', defaultMessage: 'Rebuild Index' })}
          </Button>
        </div>

        {/* Stats Summary */}
        {statsData && (
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(statsData.dimensions).map(([dim, data]) => (
              <Card key={dim}>
                <CardContent className="pt-4">
                  <div className="text-sm text-muted-foreground capitalize">{dim}</div>
                  <div className="text-2xl font-bold">{(data as { count: number }).count}</div>
                  <div className="text-xs text-muted-foreground">
                    {(data as { requiredCount: number }).requiredCount} required
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Specs Grid */}
        {filteredSpecs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {isLoading
                ? formatMessage({ id: 'specs.loading', defaultMessage: 'Loading specs...' })
                : formatMessage({ id: 'specs.noSpecs', defaultMessage: 'No specs found. Create specs in .workflow/ directory.' })
              }
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {filteredSpecs.map(spec => (
              <SpecCard
                key={spec.id}
                spec={spec}
                onEdit={handleSpecEdit}
                onToggle={handleSpecToggle}
                onDelete={handleSpecDelete}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderHooksTab = () => {
    const filteredHooks = hooks.filter(hook => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return hook.name.toLowerCase().includes(query) ||
        hook.event.toLowerCase().includes(query);
    });

    // Recommended hooks
    const recommendedHooks: HookConfig[] = [
      {
        id: 'spec-injection-session',
        name: 'Spec Context Injection (Session)',
        event: 'SessionStart',
        command: 'ccw spec load --stdin',
        scope: 'global',
        enabled: true,
        timeout: 5000,
        failMode: 'silent'
      },
      {
        id: 'spec-injection-prompt',
        name: 'Spec Context Injection (Prompt)',
        event: 'UserPromptSubmit',
        command: 'ccw spec load --stdin',
        scope: 'project',
        enabled: true,
        timeout: 5000,
        failMode: 'silent'
      }
    ];

    return (
      <div className="space-y-6">
        {/* Recommended Hooks Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5" />
              {formatMessage({ id: 'specs.recommendedHooks', defaultMessage: 'Recommended Hooks' })}
            </CardTitle>
            <CardDescription>
              {formatMessage({ id: 'specs.recommendedHooksDesc', defaultMessage: 'One-click install system-preset spec injection hooks' })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 mb-4">
              <Button onClick={() => console.log('Install all')}>
                {formatMessage({ id: 'specs.installAll', defaultMessage: 'Install All Recommended Hooks' })}
              </Button>
              <div className="text-sm text-muted-foreground flex items-center">
                {hooks.filter(h => recommendedHooks.some(r => r.command === h.command)).length} / {recommendedHooks.length} installed
              </div>
            </div>
            <div className="grid gap-3">
              {recommendedHooks.map(hook => (
                <HookCard
                  key={hook.id}
                  hook={hook}
                  isRecommended={true}
                  onInstall={() => console.log('Install:', hook.id)}
                  onEdit={handleHookEdit}
                  onToggle={handleHookToggle}
                  onDelete={handleHookDelete}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Installed Hooks Section */}
        <Card>
          <CardHeader>
            <CardTitle>{formatMessage({ id: 'specs.installedHooks', defaultMessage: 'Installed Hooks' })}</CardTitle>
            <CardDescription>
              {formatMessage({ id: 'specs.installedHooksDesc', defaultMessage: 'Manage your installed hooks configuration' })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={formatMessage({ id: 'specs.searchHooks', defaultMessage: 'Search hooks...' })}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {filteredHooks.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                {formatMessage({ id: 'specs.noHooks', defaultMessage: 'No hooks installed. Install recommended hooks above.' })}
              </div>
            ) : (
              <div className="grid gap-3">
                {filteredHooks.map(hook => (
                  <HookCard
                    key={hook.id}
                    hook={hook}
                    onEdit={handleHookEdit}
                    onToggle={handleHookToggle}
                    onDelete={handleHookDelete}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="container py-6 max-w-6xl">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScrollText className="h-6 w-6" />
          {formatMessage({ id: 'specs.pageTitle', defaultMessage: 'Spec Settings' })}
        </h1>
        <p className="text-muted-foreground mt-1">
          {formatMessage({ id: 'specs.pageDescription', defaultMessage: 'Manage specification injection, hooks, and system settings' })}
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as SettingsTab)}>
        <TabsList className="grid grid-cols-5 mb-6">
          <TabsTrigger value="project-specs" className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            <span className="hidden sm:inline">{formatMessage({ id: 'specs.tabProjectSpecs', defaultMessage: 'Project Specs' })}</span>
          </TabsTrigger>
          <TabsTrigger value="personal-specs" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            <span className="hidden sm:inline">{formatMessage({ id: 'specs.tabPersonalSpecs', defaultMessage: 'Personal' })}</span>
          </TabsTrigger>
          <TabsTrigger value="hooks" className="flex items-center gap-2">
            <Plug className="h-4 w-4" />
            <span className="hidden sm:inline">{formatMessage({ id: 'specs.tabHooks', defaultMessage: 'Hooks' })}</span>
          </TabsTrigger>
          <TabsTrigger value="injection" className="flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            <span className="hidden sm:inline">{formatMessage({ id: 'specs.tabInjection', defaultMessage: 'Injection' })}</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">{formatMessage({ id: 'specs.tabSettings', defaultMessage: 'Settings' })}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="project-specs">
          {renderSpecsTab('project')}
        </TabsContent>

        <TabsContent value="personal-specs">
          {renderSpecsTab('personal')}
        </TabsContent>

        <TabsContent value="hooks">
          {renderHooksTab()}
        </TabsContent>

        <TabsContent value="injection">
          <InjectionControlTab />
        </TabsContent>

        <TabsContent value="settings">
          <GlobalSettingsTab />
        </TabsContent>
      </Tabs>

      {/* Edit Spec Dialog */}
      <SpecDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        spec={editingSpec}
        onSave={handleSpecSave}
      />

      {/* Edit Hook Dialog */}
      <HookDialog
        open={hookDialogOpen}
        onOpenChange={setHookDialogOpen}
        hook={editingHook}
        onSave={handleHookSave}
      />
    </div>
  );
}

export default SpecsSettingsPage;
