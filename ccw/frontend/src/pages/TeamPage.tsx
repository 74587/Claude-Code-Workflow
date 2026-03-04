// ========================================
// TeamPage
// ========================================
// Main page for team execution - list/detail dual view with tabbed detail

import { useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Package, MessageSquare, Maximize2, Minimize2, GitBranch } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import { useAppStore, selectIsImmersiveMode } from '@/stores/appStore';
import { TabsNavigation, type TabItem } from '@/components/ui/TabsNavigation';
import { useTeamStore } from '@/stores/teamStore';
import type { TeamDetailTab } from '@/stores/teamStore';
import { useTeams, useTeamMessages, useTeamStatus } from '@/hooks/useTeamData';
import { TeamHeader } from '@/components/team/TeamHeader';
import { DynamicPipeline } from '@/components/team/DynamicPipeline';
import { TeamRolePanel } from '@/components/team/TeamRolePanel';
import { SessionCoordinates } from '@/components/team/SessionCoordinates';
import { TeamMessageFeed } from '@/components/team/TeamMessageFeed';
import { TeamArtifacts } from '@/components/team/TeamArtifacts';
import { TeamListView } from '@/components/team/TeamListView';
import { derivePipelineStages, detectMultiPhase } from '@/lib/pipeline-utils';

export function TeamPage() {
  const { formatMessage } = useIntl();
  const {
    selectedTeam,
    viewMode,
    autoRefresh,
    toggleAutoRefresh,
    messageFilter,
    setMessageFilter,
    clearMessageFilter,
    timelineExpanded,
    setTimelineExpanded,
    detailTab,
    setDetailTab,
    backToList,
    locationFilter,
  } = useTeamStore();
  const isImmersiveMode = useAppStore(selectIsImmersiveMode);
  const toggleImmersiveMode = useAppStore((s) => s.toggleImmersiveMode);

  // Data hooks
  const { teams } = useTeams(locationFilter);
  const { messages, total: messageTotal } = useTeamMessages(
    viewMode === 'detail' ? selectedTeam : null,
    messageFilter
  );
  const { members, totalMessages } = useTeamStatus(
    viewMode === 'detail' ? selectedTeam : null
  );

  // Find enriched team data from list response
  const teamData = useMemo(
    () => teams.find((t) => t.name === selectedTeam),
    [teams, selectedTeam]
  );

  // Derive dynamic pipeline stages and multi-phase info
  const stages = useMemo(
    () =>
      derivePipelineStages(
        {
          pipeline_stages: teamData?.pipeline_stages,
          role_state: teamData?.role_state,
          roles: teamData?.roles,
        },
        messages
      ),
    [teamData?.pipeline_stages, teamData?.role_state, teamData?.roles, messages]
  );

  const phaseInfo = useMemo(
    () => detectMultiPhase(teamData?.role_state),
    [teamData?.role_state]
  );

  // List view (also fallback when selected team data is not available)
  if (viewMode === 'list' || !selectedTeam || (viewMode === 'detail' && teams.length > 0 && !teamData)) {
    return (
      <div className="space-y-6">
        <TeamListView />
      </div>
    );
  }

  const tabs: TabItem[] = [
    {
      value: 'pipeline',
      label: formatMessage({ id: 'team.tabs.pipeline' }),
      icon: <GitBranch className="h-4 w-4" />,
    },
    {
      value: 'artifacts',
      label: formatMessage({ id: 'team.tabs.artifacts' }),
      icon: <Package className="h-4 w-4" />,
    },
    {
      value: 'messages',
      label: formatMessage({ id: 'team.tabs.messages' }),
      icon: <MessageSquare className="h-4 w-4" />,
    },
  ];

  // Detail view
  return (
    <div className={cn("space-y-6", isImmersiveMode && "h-screen overflow-hidden")}>
      {/* Detail Header */}
      <div className="flex items-center justify-between">
        <TeamHeader
          selectedTeam={selectedTeam}
          onBack={backToList}
          members={members}
          totalMessages={totalMessages}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={toggleAutoRefresh}
          skillType={teamData?.team_name ? `team-${teamData.team_name}` : undefined}
          pipelineMode={teamData?.pipeline_mode}
        />
        <button
          onClick={toggleImmersiveMode}
          className={cn(
            'p-2 rounded-md transition-colors',
            isImmersiveMode
              ? 'bg-primary/10 text-primary'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          )}
          title={isImmersiveMode ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isImmersiveMode ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Overview: DynamicPipeline + TeamRolePanel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 flex flex-col">
          <CardContent className="p-4 flex-1">
            <DynamicPipeline stages={stages} phaseInfo={phaseInfo} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <TeamRolePanel
              members={members}
              stages={stages}
              roleState={teamData?.role_state}
            />
          </CardContent>
        </Card>
      </div>

      {/* Session Coordinates (only for multi-phase sessions) */}
      {phaseInfo && (
        <SessionCoordinates phaseInfo={phaseInfo} />
      )}

      {/* Tab Navigation */}
      <TabsNavigation
        value={detailTab}
        onValueChange={(v) => setDetailTab(v as TeamDetailTab)}
        tabs={tabs}
      />

      {/* Pipeline Tab - shows role details */}
      {detailTab === 'pipeline' && (
        <Card>
          <CardContent className="p-6">
            <TeamRolePanel
              members={members}
              stages={stages}
              roleState={teamData?.role_state}
            />
          </CardContent>
        </Card>
      )}

      {/* Artifacts Tab */}
      {detailTab === 'artifacts' && (
        <TeamArtifacts teamName={selectedTeam} />
      )}

      {/* Messages Tab */}
      {detailTab === 'messages' && (
        <TeamMessageFeed
          messages={messages}
          total={messageTotal}
          filter={messageFilter}
          onFilterChange={setMessageFilter}
          onClearFilter={clearMessageFilter}
          expanded={timelineExpanded}
          onExpandedChange={setTimelineExpanded}
        />
      )}
    </div>
  );
}

export default TeamPage;
