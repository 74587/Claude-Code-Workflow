// ========================================
// Issue Hub Page
// ========================================
// Unified page for issues, queue, and discovery with tab navigation

import { useSearchParams } from 'react-router-dom';
import { IssueHubHeader } from '@/components/issue/hub/IssueHubHeader';
import { IssueHubTabs, type IssueTab } from '@/components/issue/hub/IssueHubTabs';
import { IssuesPanel } from '@/components/issue/hub/IssuesPanel';
import { QueuePanel } from '@/components/issue/hub/QueuePanel';
import { DiscoveryPanel } from '@/components/issue/hub/DiscoveryPanel';

export function IssueHubPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentTab = (searchParams.get('tab') as IssueTab) || 'issues';

  const setCurrentTab = (tab: IssueTab) => {
    setSearchParams({ tab });
  };

  return (
    <div className="space-y-6">
      <IssueHubHeader currentTab={currentTab} />
      <IssueHubTabs currentTab={currentTab} onTabChange={setCurrentTab} />
      {currentTab === 'issues' && <IssuesPanel />}
      {currentTab === 'queue' && <QueuePanel />}
      {currentTab === 'discovery' && <DiscoveryPanel />}
    </div>
  );
}

export default IssueHubPage;
