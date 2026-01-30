// ========================================
// Skills Manager Page
// ========================================
// Browse and manage skills library with search/filter

import { useState, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Plus,
  Filter,
  RefreshCw,
  Power,
  PowerOff,
  Tag,
  Loader2,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/Select';
import { SkillCard } from '@/components/shared/SkillCard';
import { useSkills, useSkillMutations } from '@/hooks';
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
        <h3 className="mt-4 text-lg font-medium text-foreground">No skills found</h3>
        <p className="mt-2 text-muted-foreground">
          Try adjusting your search or filters.
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
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [enabledFilter, setEnabledFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'compact'>('grid');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);

  const {
    skills,
    enabledSkills,
    categories,
    skillsByCategory,
    totalCount,
    enabledCount,
    isLoading,
    isFetching,
    refetch,
  } = useSkills({
    filter: {
      search: searchQuery || undefined,
      category: categoryFilter !== 'all' ? categoryFilter : undefined,
      source: sourceFilter !== 'all' ? sourceFilter as Skill['source'] : undefined,
      enabledOnly: enabledFilter === 'enabled',
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

  const handleToggle = async (skill: Skill, enabled: boolean) => {
    await toggleSkill(skill.name, enabled);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Skills Manager
          </h1>
          <p className="text-muted-foreground mt-1">
            Browse, install, and manage Claude Code skills
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('w-4 h-4 mr-2', isFetching && 'animate-spin')} />
            Refresh
          </Button>
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Install Skill
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold">{totalCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Total Skills</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Power className="w-5 h-5 text-success" />
            <span className="text-2xl font-bold">{enabledCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Enabled</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <PowerOff className="w-5 h-5 text-muted-foreground" />
            <span className="text-2xl font-bold">{totalCount - enabledCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Disabled</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5 text-info" />
            <span className="text-2xl font-bold">{categories.length}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">Categories</p>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search skills by name, description, or trigger..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Source" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              <SelectItem value="builtin">Built-in</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
              <SelectItem value="community">Community</SelectItem>
            </SelectContent>
          </Select>
          <Select value={enabledFilter} onValueChange={(v) => setEnabledFilter(v as 'all' | 'enabled' | 'disabled')}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="enabled">Enabled Only</SelectItem>
              <SelectItem value="disabled">Disabled Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={enabledFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEnabledFilter('all')}
        >
          All ({totalCount})
        </Button>
        <Button
          variant={enabledFilter === 'enabled' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEnabledFilter('enabled')}
        >
          <Power className="w-4 h-4 mr-1" />
          Enabled ({enabledCount})
        </Button>
        <Button
          variant={enabledFilter === 'disabled' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEnabledFilter('disabled')}
        >
          <PowerOff className="w-4 h-4 mr-1" />
          Disabled ({totalCount - enabledCount})
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewMode(viewMode === 'grid' ? 'compact' : 'grid')}
        >
          {viewMode === 'grid' ? 'Compact View' : 'Grid View'}
        </Button>
      </div>

      {/* Skills Grid */}
      <SkillGrid
        skills={filteredSkills}
        isLoading={isLoading}
        onToggle={handleToggle}
        onClick={setSelectedSkill}
        isToggling={isToggling}
        compact={viewMode === 'compact'}
      />
    </div>
  );
}

export default SkillsManagerPage;
