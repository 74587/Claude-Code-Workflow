// ========================================
// Skills Manager Page
// ========================================
// Browse and manage skills library with search/filter

import { useState, useMemo, useCallback } from 'react';
import { useIntl } from 'react-intl';
import {
  Sparkles,
  Search,
  Plus,
  RefreshCw,
  Power,
  PowerOff,
  Tag,
  ChevronDown,
  ChevronRight,
  EyeOff,
  List,
  Grid3x3,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui';
import { SkillCard, SkillDetailPanel } from '@/components/shared';
import { LocationSwitcher } from '@/components/commands/LocationSwitcher';
import { useSkills, useSkillMutations } from '@/hooks';
import { fetchSkillDetail } from '@/lib/api';
import { useWorkflowStore, selectProjectPath } from '@/stores/workflowStore';
import type { Skill } from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Skill Grid Component ==========

interface SkillGridProps {
  skills: Skill[];
  isLoading: boolean;
  onToggle: (skill: Skill, enabled: boolean) => void;
  onClick: (skill: Skill) => void;
  isToggling: boolean;
  compact?: boolean;
}

function SkillGrid({ skills, isLoading, onToggle, onClick, isToggling, compact }: SkillGridProps) {
  const { formatMessage } = useIntl();

  if (isLoading) {
    return (
      <div className={cn(
        'grid gap-4',
        compact ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-3'
      )}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-48 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (skills.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Sparkles className="w-12 h-12 mx-auto text-muted-foreground/50" />
        <h3 className="mt-4 text-lg font-medium text-foreground">{formatMessage({ id: 'skills.emptyState.title' })}</h3>
        <p className="mt-2 text-muted-foreground">
          {formatMessage({ id: 'skills.emptyState.message' })}
        </p>
      </Card>
    );
  }

  return (
    <div className={cn(
      'grid gap-4',
      compact ? 'grid-cols-1' : 'md:grid-cols-2 lg:grid-cols-3'
    )}>
      {skills.map((skill) => (
        <SkillCard
          key={skill.name}
          skill={skill}
          onToggle={onToggle}
          onClick={onClick}
          isToggling={isToggling}
          compact={compact}
        />
      ))}
    </div>
  );
}

// ========== Main Page Component ==========

export function SkillsManagerPage() {
  const { formatMessage } = useIntl();
  const projectPath = useWorkflowStore(selectProjectPath);

  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');
  const [showDisabledSection, setShowDisabledSection] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState<{ skill: Skill; enable: boolean } | null>(null);
  const [locationFilter, setLocationFilter] = useState<'project' | 'user'>('project');

  // Skill detail panel state
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);

  const {
    skills,
    categories,
    projectSkills,
    userSkills,
    isLoading,
    isFetching,
    refetch,
  } = useSkills({
    filter: {
      search: searchQuery || undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      source: sourceFilter !== 'all' ? sourceFilter as Skill['source'] : undefined,
      enabledOnly: enabledFilter === 'enabled',
      location: locationFilter,
    },
  });

  const { toggleSkill, isToggling } = useSkillMutations();

  // Filter skills based on enabled filter
  const filteredSkills = useMemo(() => {
    if (enabledFilter === 'disabled') {
      return skills.filter((s) => !s.enabled);
    }
    return skills;
  }, [skills, enabledFilter]);

  // Calculate counts based on current location filter (from skills, not allSkills)
  const currentLocationEnabledCount = useMemo(() => skills.filter(s => s.enabled).length, [skills]);
  const currentLocationTotalCount = skills.length;
  const currentLocationDisabledCount = currentLocationTotalCount - currentLocationEnabledCount;

  const handleToggle = async (skill: Skill, enabled: boolean) => {
    // Use the skill's location property
    const location = skill.location || 'project';
    // Use folderName for API calls (actual folder name), fallback to name if not available
    const skillIdentifier = skill.folderName || skill.name;
    
    // Debug logging
    console.log('[SkillToggle] Toggling skill:', { 
      name: skill.name, 
      folderName: skill.folderName, 
      location, 
      enabled, 
      skillIdentifier 
    });
    
    try {
      await toggleSkill(skillIdentifier, enabled, location);
    } catch (error) {
      console.error('[SkillToggle] Toggle failed:', error);
      throw error;
    }
  };

  const handleToggleWithConfirm = (skill: Skill, enabled: boolean) => {
    if (!enabled) {
      // Show confirmation dialog when disabling
      setConfirmDisable({ skill, enable: false });
    } else {
      // Enable directly without confirmation
      handleToggle(skill, true);
    }
  };

  const handleConfirmDisable = async () => {
    if (confirmDisable) {
      await handleToggle(confirmDisable.skill, false);
      setConfirmDisable(null);
    }
  };

  // Skill detail panel handlers
  const handleSkillClick = useCallback(async (skill: Skill) => {
    setIsDetailLoading(true);
    setIsDetailPanelOpen(true);
    setSelectedSkill(skill);

    try {
      // Fetch full skill details from API
      const data = await fetchSkillDetail(
        skill.name,
        skill.location || 'project',
        projectPath
      );
      setSelectedSkill(data.skill);
    } catch (error) {
      console.error('Failed to fetch skill details:', error);
      // Keep the basic skill info if fetch fails
    } finally {
      setIsDetailLoading(false);
    }
  }, [projectPath]);

  const handleCloseDetailPanel = useCallback(() => {
    setIsDetailPanelOpen(false);
    setSelectedSkill(null);
  }, []);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-primary" />
              {formatMessage({ id: 'skills.title' })}
            </h1>
            <p className="text-muted-foreground mt-1">
              {formatMessage({ id: 'skills.description' })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={cn('w-4 h-4 mr-2', isFetching && 'animate-spin')} />
              {formatMessage({ id: 'common.actions.refresh' })}
            </Button>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'skills.actions.install' })}
            </Button>
          </div>
        </div>

        {/* Location Switcher */}
        <LocationSwitcher
          currentLocation={locationFilter}
          onLocationChange={setLocationFilter}
          projectCount={projectSkills.length}
          userCount={userSkills.length}
          disabled={isToggling}
          translationPrefix="skills"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold">{currentLocationTotalCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'common.stats.totalSkills' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Power className="w-5 h-5 text-success" />
            <span className="text-2xl font-bold">{currentLocationEnabledCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'skills.state.enabled' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <PowerOff className="w-5 h-5 text-muted-foreground" />
            <span className="text-2xl font-bold">{currentLocationDisabledCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'skills.state.disabled' })}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-info" />
            <span className="text-2xl font-bold">{categories.length}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">{formatMessage({ id: 'skills.card.category' })}</p>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'skills.filters.searchPlaceholder' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={formatMessage({ id: 'skills.card.category' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{formatMessage({ id: 'skills.filters.all' })}</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={formatMessage({ id: 'skills.card.source' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{formatMessage({ id: 'skills.filters.allSources' })}</SelectItem>
              <SelectItem value="builtin">{formatMessage({ id: 'skills.source.builtin' })}</SelectItem>
              <SelectItem value="custom">{formatMessage({ id: 'skills.source.custom' })}</SelectItem>
              <SelectItem value="community">{formatMessage({ id: 'skills.source.community' })}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={enabledFilter} onValueChange={(v) => setEnabledFilter(v as 'all' | 'enabled' | 'disabled')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={formatMessage({ id: 'skills.state.enabled' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{formatMessage({ id: 'skills.filters.all' })}</SelectItem>
              <SelectItem value="enabled">{formatMessage({ id: 'skills.filters.enabled' })}</SelectItem>
              <SelectItem value="disabled">{formatMessage({ id: 'skills.filters.disabled' })}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEnabledFilter('all')}
          className={enabledFilter === 'all' ? 'bg-primary text-primary-foreground' : ''}
        >
          <Sparkles className="w-4 h-4 mr-1" />
          {formatMessage({ id: 'skills.filters.all' })} ({currentLocationTotalCount})
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEnabledFilter('enabled')}
          className={enabledFilter === 'enabled' ? 'bg-primary text-primary-foreground' : ''}
        >
          <Power className="w-4 h-4 mr-1" />
          {formatMessage({ id: 'skills.state.enabled' })} ({currentLocationEnabledCount})
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEnabledFilter('disabled')}
          className={enabledFilter === 'disabled' ? 'bg-primary text-primary-foreground' : ''}
        >
          <PowerOff className="w-4 h-4 mr-1" />
          {formatMessage({ id: 'skills.state.disabled' })} ({currentLocationDisabledCount})
        </Button>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setViewMode(viewMode === 'grid' ? 'compact' : 'grid')}
        >
          {viewMode === 'grid' ? <List className="w-4 h-4 mr-1" /> : <Grid3x3 className="w-4 h-4 mr-1" />}
          {formatMessage({ id: viewMode === 'grid' ? 'skills.view.compact' : 'skills.view.grid' })}
        </Button>
      </div>

      {/* Skills Grid */}
      <SkillGrid
        skills={filteredSkills}
        isLoading={isLoading}
        onToggle={handleToggleWithConfirm}
        onClick={handleSkillClick}
        isToggling={isToggling || !!confirmDisable}
        compact={viewMode === 'compact'}
      />

      {/* Disabled Skills Section */}
      {enabledFilter === 'all' && currentLocationDisabledCount > 0 && (
        <div className="mt-6">
          <Button
            variant="ghost"
            onClick={() => setShowDisabledSection(!showDisabledSection)}
            className="mb-4 text-muted-foreground hover:text-foreground"
          >
            {showDisabledSection ? <ChevronDown className="w-4 h-4 mr-2" /> : <ChevronRight className="w-4 h-4 mr-2" />}
            <EyeOff className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'skills.disabledSkills.title' })} ({currentLocationDisabledCount})
          </Button>

          {showDisabledSection && (
            <SkillGrid
              skills={skills.filter((s) => !s.enabled)}
              isLoading={false}
              onToggle={handleToggleWithConfirm}
              onClick={handleSkillClick}
              isToggling={isToggling || !!confirmDisable}
              compact={true}
            />
          )}
        </div>
      )}

      {/* Disable Confirmation Dialog */}
      <AlertDialog open={!!confirmDisable} onOpenChange={(open) => !open && setConfirmDisable(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{formatMessage({ id: 'skills.disableConfirm.title' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage(
                { id: 'skills.disableConfirm.message' },
                { name: confirmDisable?.skill.name || '' }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{formatMessage({ id: 'skills.actions.cancel' })}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDisable} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {formatMessage({ id: 'skills.actions.confirmDisable' })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Skill Detail Panel */}
      <SkillDetailPanel
        skill={selectedSkill}
        isOpen={isDetailPanelOpen}
        onClose={handleCloseDetailPanel}
        isLoading={isDetailLoading}
      />
    </div>
  );
}

export default SkillsManagerPage;
