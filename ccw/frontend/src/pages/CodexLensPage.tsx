// ========================================
// CodexLens Page
// ========================================
// Main page for CodexLens v2 management: MCP config, models, index, env

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { Search } from 'lucide-react';
import { TabsNavigation } from '@/components/ui/TabsNavigation';
import { McpConfigTab } from '@/components/codexlens/McpConfigTab';
import { ModelManagerTab } from '@/components/codexlens/ModelManagerTab';
import { IndexManagerTab } from '@/components/codexlens/IndexManagerTab';
import { EnvSettingsTab } from '@/components/codexlens/EnvSettingsTab';

type TabType = 'mcp' | 'models' | 'index' | 'env';

export function CodexLensPage() {
  const { formatMessage } = useIntl();
  const [activeTab, setActiveTab] = useState<TabType>('mcp');

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Search className="w-6 h-6 text-primary" />
          {formatMessage({ id: 'codexlens.page.title' })}
        </h1>
        <p className="text-muted-foreground mt-1">
          {formatMessage({ id: 'codexlens.page.description' })}
        </p>
      </div>

      {/* Tab Navigation */}
      <TabsNavigation
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabType)}
        tabs={[
          { value: 'mcp', label: formatMessage({ id: 'codexlens.tabs.mcp' }) },
          { value: 'models', label: formatMessage({ id: 'codexlens.tabs.models' }) },
          { value: 'index', label: formatMessage({ id: 'codexlens.tabs.index' }) },
          { value: 'env', label: formatMessage({ id: 'codexlens.tabs.env' }) },
        ]}
      />

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === 'mcp' && <McpConfigTab />}
        {activeTab === 'models' && <ModelManagerTab />}
        {activeTab === 'index' && <IndexManagerTab />}
        {activeTab === 'env' && <EnvSettingsTab />}
      </div>
    </div>
  );
}

export default CodexLensPage;
