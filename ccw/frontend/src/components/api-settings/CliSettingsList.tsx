// ========================================
// CLI Settings List Component
// ========================================
// Display CLI settings as cards with search, filter, and actions

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  Search,
  Plus,
  Edit,
  Trash2,
  Settings,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Link as LinkIcon,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Switch } from '@/components/ui/Switch';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/Dropdown';
import {
  useCliSettings,
  useDeleteCliSettings,
  useToggleCliSettings,
} from '@/hooks/useApiSettings';
import { useNotifications } from '@/hooks/useNotifications';
import type { CliSettingsEndpoint } from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Types ==========

export interface CliSettingsListProps {
  onAddCliSettings: () => void;
  onEditCliSettings: (endpointId: string) => void;
}

// ========== Helper Components ==========

interface CliSettingsCardProps {
  cliSettings: CliSettingsEndpoint;
  onEdit: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  isDeleting: boolean;
  isToggling: boolean;
}

function CliSettingsCard({
  cliSettings,
  onEdit,
  onDelete,
  onToggleEnabled,
  isDeleting,
  isToggling,
}: CliSettingsCardProps) {
  const { formatMessage } = useIntl();

  // Determine mode based on settings
  const isProviderBased = Boolean(
    cliSettings.settings.env.ANTHROPIC_BASE_URL &&
    !cliSettings.settings.env.ANTHROPIC_BASE_URL.includes('api.anthropic.com')
  );

  const getModeBadge = () => {
    if (isProviderBased) {
      return (
        <Badge variant="secondary" className="text-xs">
          {formatMessage({ id: 'apiSettings.cliSettings.providerBased' })}
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        {formatMessage({ id: 'apiSettings.cliSettings.direct' })}
      </Badge>
    );
  };

  const getStatusBadge = () => {
    if (!cliSettings.enabled) {
      return <Badge variant="secondary">{formatMessage({ id: 'apiSettings.common.disabled' })}</Badge>;
    }
    return <Badge variant="success">{formatMessage({ id: 'apiSettings.common.enabled' })}</Badge>;
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        {/* Left: CLI Settings Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-foreground truncate">{cliSettings.name}</h3>
            {getStatusBadge()}
            {getModeBadge()}
          </div>
          {cliSettings.description && (
            <p className="text-sm text-muted-foreground mt-1">{cliSettings.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <Settings className="w-3 h-3" />
              {cliSettings.settings.model || 'sonnet'}
            </span>
            {cliSettings.settings.env.ANTHROPIC_BASE_URL && (
              <span className="flex items-center gap-1 truncate max-w-[200px]" title={cliSettings.settings.env.ANTHROPIC_BASE_URL}>
                <LinkIcon className="w-3 h-3 flex-shrink-0" />
                {cliSettings.settings.env.ANTHROPIC_BASE_URL}
              </span>
            )}
            {cliSettings.settings.includeCoAuthoredBy !== undefined && (
              <span>
                {formatMessage({ id: 'apiSettings.cliSettings.coAuthoredBy' })}: {formatMessage({ id: cliSettings.settings.includeCoAuthoredBy ? 'common.yes' : 'common.no' })}
              </span>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <Switch
            checked={cliSettings.enabled}
            onCheckedChange={onToggleEnabled}
            disabled={isToggling}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'apiSettings.cliSettings.actions.edit' })}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} disabled={isDeleting} className="text-destructive">
                <Trash2 className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'apiSettings.cliSettings.actions.delete' })}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </Card>
  );
}

// ========== Main Component ==========

export function CliSettingsList({
  onAddCliSettings,
  onEditCliSettings,
}: CliSettingsListProps) {
  const { formatMessage } = useIntl();
  const { showNotification } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');

  const {
    cliSettings,
    totalCount,
    enabledCount,
    providerBasedCount,
    directCount,
    isLoading,
    refetch,
  } = useCliSettings();

  const { deleteCliSettings, isDeleting } = useDeleteCliSettings();
  const { toggleCliSettings, isToggling } = useToggleCliSettings();

  // Filter settings by search query
  const filteredSettings = useMemo(() => {
    if (!searchQuery) return cliSettings;
    const query = searchQuery.toLowerCase();
    return cliSettings.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.description?.toLowerCase().includes(query) ||
        s.id.toLowerCase().includes(query)
    );
  }, [cliSettings, searchQuery]);

  // Handlers
  const handleDelete = async (endpointId: string) => {
    const settings = cliSettings.find((s) => s.id === endpointId);
    if (!settings) return;

    const confirmMessage = formatMessage(
      { id: 'apiSettings.cliSettings.deleteConfirm' },
      { name: settings.name }
    );

    if (confirm(confirmMessage)) {
      try {
        await deleteCliSettings(endpointId);
      } catch (error) {
        showNotification('error', formatMessage({ id: 'apiSettings.cliSettings.deleteError' }));
      }
    }
  };

  const handleToggleEnabled = async (endpointId: string, enabled: boolean) => {
    try {
      await toggleCliSettings(endpointId, enabled);
    } catch (error) {
      showNotification('error', formatMessage({ id: 'apiSettings.cliSettings.toggleError' }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary" />
            <span className="text-2xl font-bold">{totalCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'apiSettings.cliSettings.stats.total' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            <span className="text-2xl font-bold">{enabledCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'apiSettings.cliSettings.stats.enabled' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <LinkIcon className="w-5 h-5 text-blue-500" />
            <span className="text-2xl font-bold">{providerBasedCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'apiSettings.cliSettings.providerBased' })}
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-orange-500" />
            <span className="text-2xl font-bold">{directCount}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {formatMessage({ id: 'apiSettings.cliSettings.direct' })}
          </p>
        </Card>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'apiSettings.cliSettings.searchPlaceholder' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
          <Button onClick={onAddCliSettings}>
            <Plus className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'apiSettings.cliSettings.actions.add' })}
          </Button>
        </div>
      </div>

      {/* CLI Settings Cards */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : filteredSettings.length === 0 ? (
        <Card className="p-8 text-center">
          <Settings className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            {formatMessage({ id: 'apiSettings.cliSettings.emptyState.title' })}
          </h3>
          <p className="mt-2 text-muted-foreground">
            {formatMessage({ id: 'apiSettings.cliSettings.emptyState.message' })}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredSettings.map((settings) => (
            <CliSettingsCard
              key={settings.id}
              cliSettings={settings}
              onEdit={() => onEditCliSettings(settings.id)}
              onDelete={() => handleDelete(settings.id)}
              onToggleEnabled={(enabled) => handleToggleEnabled(settings.id, enabled)}
              isDeleting={isDeleting}
              isToggling={isToggling}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default CliSettingsList;
