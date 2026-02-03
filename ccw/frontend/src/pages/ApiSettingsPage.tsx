// ========================================
// API Settings Page
// ========================================
// Main page for managing LiteLLM API providers, endpoints, cache, model pools, and CLI settings

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Server,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/Tabs';
import {
  ProviderList,
  ProviderModal,
  EndpointList,
  EndpointModal,
  CacheSettings,
  ModelPoolList,
  ModelPoolModal,
  CliSettingsList,
  CliSettingsModal,
  MultiKeySettingsModal,
  ManageModelsModal,
} from '@/components/api-settings';
import { useProviders, useEndpoints, useModelPools, useCliSettings } from '@/hooks/useApiSettings';
import { useNotifications } from '@/hooks/useNotifications';

// Tab type definitions
type TabType = 'providers' | 'endpoints' | 'cache' | 'modelPools' | 'cliSettings';

export function ApiSettingsPage() {
  const { formatMessage } = useIntl();
  const { success, error } = useNotifications();
  const [activeTab, setActiveTab] = useState<TabType>('providers');

  // Get providers, endpoints, model pools, and CLI settings data
  const { providers } = useProviders();
  const { endpoints } = useEndpoints();
  const { pools } = useModelPools();
  const { cliSettings } = useCliSettings();

  // Modal states
  const [providerModalOpen, setProviderModalOpen] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [endpointModalOpen, setEndpointModalOpen] = useState(false);
  const [editingEndpointId, setEditingEndpointId] = useState<string | null>(null);
  const [modelPoolModalOpen, setModelPoolModalOpen] = useState(false);
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [cliSettingsModalOpen, setCliSettingsModalOpen] = useState(false);
  const [editingCliSettingsId, setEditingCliSettingsId] = useState<string | null>(null);

  // Additional modal states for multi-key settings and model management
  const [multiKeyModalOpen, setMultiKeyModalOpen] = useState(false);
  const [multiKeyProviderId, setMultiKeyProviderId] = useState<string | null>(null);
  const [manageModelsModalOpen, setManageModelsModalOpen] = useState(false);
  const [manageModelsProviderId, setManageModelsProviderId] = useState<string | null>(null);

  // Find the provider being edited
  const editingProvider = useMemo(
    () => providers.find((p) => p.id === editingProviderId) || null,
    [providers, editingProviderId]
  );

  // Find the endpoint being edited
  const editingEndpoint = useMemo(
    () => endpoints.find((e) => e.id === editingEndpointId) || null,
    [endpoints, editingEndpointId]
  );

  // Find the pool being edited
  const editingPool = useMemo(
    () => pools.find((p) => p.id === editingPoolId) || null,
    [pools, editingPoolId]
  );

  // Find the CLI settings being edited
  const editingCliSettings = useMemo(
    () => cliSettings.find((s) => s.id === editingCliSettingsId) || null,
    [cliSettings, editingCliSettingsId]
  );

  // Provider modal handlers
  const handleAddProvider = () => {
    setEditingProviderId(null);
    setProviderModalOpen(true);
  };

  const handleEditProvider = (providerId: string) => {
    setEditingProviderId(providerId);
    setProviderModalOpen(true);
  };

  const handleCloseProviderModal = () => {
    setProviderModalOpen(false);
    setEditingProviderId(null);
  };

  // Endpoint modal handlers
  const handleAddEndpoint = () => {
    setEditingEndpointId(null);
    setEndpointModalOpen(true);
  };

  const handleEditEndpoint = (endpointId: string) => {
    setEditingEndpointId(endpointId);
    setEndpointModalOpen(true);
  };

  const handleCloseEndpointModal = () => {
    setEndpointModalOpen(false);
    setEditingEndpointId(null);
  };

  // Model pool modal handlers
  const handleAddPool = () => {
    setEditingPoolId(null);
    setModelPoolModalOpen(true);
  };

  const handleEditPool = (poolId: string) => {
    setEditingPoolId(poolId);
    setModelPoolModalOpen(true);
  };

  const handleClosePoolModal = () => {
    setModelPoolModalOpen(false);
    setEditingPoolId(null);
  };

  // CLI Settings modal handlers
  const handleAddCliSettings = () => {
    setEditingCliSettingsId(null);
    setCliSettingsModalOpen(true);
  };

  const handleEditCliSettings = (endpointId: string) => {
    setEditingCliSettingsId(endpointId);
    setCliSettingsModalOpen(true);
  };

  const handleCloseCliSettingsModal = () => {
    setCliSettingsModalOpen(false);
    setEditingCliSettingsId(null);
  };

  // Multi-key settings modal handlers
  const handleMultiKeySettings = (providerId: string) => {
    setMultiKeyProviderId(providerId);
    setMultiKeyModalOpen(true);
  };

  const handleCloseMultiKeyModal = () => {
    setMultiKeyModalOpen(false);
    setMultiKeyProviderId(null);
  };

  // Manage models modal handlers
  const handleManageModels = (providerId: string) => {
    setManageModelsProviderId(providerId);
    setManageModelsModalOpen(true);
  };

  const handleCloseManageModelsModal = () => {
    setManageModelsModalOpen(false);
    setManageModelsProviderId(null);
  };

  // Sync to CodexLens handler
  const handleSyncToCodexLens = async (providerId: string) => {
    try {
      // TODO: Implement actual sync API call
      // For now, just show a success message
      success(formatMessage({ id: 'apiSettings.messages.configSynced' }));
    } catch (err) {
      error(formatMessage({ id: 'apiSettings.providers.saveError' }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Server className="w-6 h-6 text-primary" />
            {formatMessage({ id: 'apiSettings.title' })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatMessage({ id: 'apiSettings.description' })}
          </p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()}>
          <RefreshCw className="w-4 h-4 mr-2" />
          {formatMessage({ id: 'common.actions.refresh' })}
        </Button>
      </div>

      {/* Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList>
          <TabsTrigger value="providers">
            {formatMessage({ id: 'apiSettings.tabs.providers' })}
          </TabsTrigger>
          <TabsTrigger value="endpoints">
            {formatMessage({ id: 'apiSettings.tabs.endpoints' })}
          </TabsTrigger>
          <TabsTrigger value="cache">
            {formatMessage({ id: 'apiSettings.tabs.cache' })}
          </TabsTrigger>
          <TabsTrigger value="modelPools">
            {formatMessage({ id: 'apiSettings.tabs.modelPools' })}
          </TabsTrigger>
          <TabsTrigger value="cliSettings">
            {formatMessage({ id: 'apiSettings.tabs.cliSettings' })}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="providers">
          <ProviderList
            onAddProvider={handleAddProvider}
            onEditProvider={handleEditProvider}
            onMultiKeySettings={handleMultiKeySettings}
            onSyncToCodexLens={handleSyncToCodexLens}
            onManageModels={handleManageModels}
          />
        </TabsContent>

        <TabsContent value="endpoints">
          <EndpointList
            onAddEndpoint={handleAddEndpoint}
            onEditEndpoint={handleEditEndpoint}
          />
        </TabsContent>

        <TabsContent value="cache">
          <CacheSettings />
        </TabsContent>

        <TabsContent value="modelPools">
          <ModelPoolList
            onAddPool={handleAddPool}
            onEditPool={handleEditPool}
          />
        </TabsContent>

        <TabsContent value="cliSettings">
          <CliSettingsList
            onAddCliSettings={handleAddCliSettings}
            onEditCliSettings={handleEditCliSettings}
          />
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <ProviderModal
        open={providerModalOpen}
        onClose={handleCloseProviderModal}
        provider={editingProvider}
      />
      <EndpointModal
        open={endpointModalOpen}
        onClose={handleCloseEndpointModal}
        endpoint={editingEndpoint}
      />
      <ModelPoolModal
        open={modelPoolModalOpen}
        onClose={handleClosePoolModal}
        pool={editingPool}
      />
      <CliSettingsModal
        open={cliSettingsModalOpen}
        onClose={handleCloseCliSettingsModal}
        cliSettings={editingCliSettings}
      />
      <MultiKeySettingsModal
        open={multiKeyModalOpen}
        onClose={handleCloseMultiKeyModal}
        providerId={multiKeyProviderId || ''}
      />
      <ManageModelsModal
        open={manageModelsModalOpen}
        onClose={handleCloseManageModelsModal}
        providerId={manageModelsProviderId || ''}
      />
    </div>
  );
}

export default ApiSettingsPage;
