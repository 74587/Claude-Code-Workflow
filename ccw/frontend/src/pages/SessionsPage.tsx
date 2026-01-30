// ========================================
// SessionsPage Component
// ========================================
// Sessions list page with CRUD operations

import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  RefreshCw,
  Search,
  Filter,
  AlertCircle,
  FolderKanban,
  X,
} from 'lucide-react';
import {
  useSessions,
  useCreateSession,
  useArchiveSession,
  useDeleteSession,
  type SessionsFilter,
} from '@/hooks/useSessions';
import { SessionCard, SessionCardSkeleton } from '@/components/shared/SessionCard';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/Dropdown';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/Tabs';
import { cn } from '@/lib/utils';
import type { SessionMetadata } from '@/types/store';

type LocationFilter = 'all' | 'active' | 'archived';

/**
 * SessionsPage component - Sessions list with CRUD operations
 */
export function SessionsPage() {
  const navigate = useNavigate();

  // Filter state
  const [locationFilter, setLocationFilter] = React.useState<LocationFilter>('active');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<SessionMetadata['status'][]>([]);

  // Dialog state
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [sessionToDelete, setSessionToDelete] = React.useState<string | null>(null);

  // Create session form state
  const [newSessionId, setNewSessionId] = React.useState('');
  const [newSessionTitle, setNewSessionTitle] = React.useState('');
  const [newSessionDescription, setNewSessionDescription] = React.useState('');

  // Build filter object
  const filter: SessionsFilter = React.useMemo(
    () => ({
      location: locationFilter,
      search: searchQuery,
      status: statusFilter.length > 0 ? statusFilter : undefined,
    }),
    [locationFilter, searchQuery, statusFilter]
  );

  // Fetch sessions with filter
  const {
    filteredSessions,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useSessions({ filter });

  // Mutations
  const { createSession, isCreating } = useCreateSession();
  const { archiveSession, isArchiving } = useArchiveSession();
  const { deleteSession, isDeleting } = useDeleteSession();

  const isMutating = isCreating || isArchiving || isDeleting;

  // Handlers
  const handleSessionClick = (sessionId: string) => {
    navigate(`/sessions/${sessionId}`);
  };

  const handleCreateSession = async () => {
    if (!newSessionId.trim()) return;

    try {
      await createSession({
        session_id: newSessionId.trim(),
        title: newSessionTitle.trim() || undefined,
        description: newSessionDescription.trim() || undefined,
      });
      setCreateDialogOpen(false);
      resetCreateForm();
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  };

  const resetCreateForm = () => {
    setNewSessionId('');
    setNewSessionTitle('');
    setNewSessionDescription('');
  };

  const handleArchive = async (sessionId: string) => {
    try {
      await archiveSession(sessionId);
    } catch (err) {
      console.error('Failed to archive session:', err);
    }
  };

  const handleDeleteClick = (sessionId: string) => {
    setSessionToDelete(sessionId);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;

    try {
      await deleteSession(sessionToDelete);
      setDeleteDialogOpen(false);
      setSessionToDelete(null);
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const toggleStatusFilter = (status: SessionMetadata['status']) => {
    setStatusFilter((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const clearFilters = () => {
    setStatusFilter([]);
    setSearchQuery('');
  };

  const hasActiveFilters = statusFilter.length > 0 || searchQuery.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Sessions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your workflow sessions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn('h-4 w-4 mr-2', isFetching && 'animate-spin')} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Session
          </Button>
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium">Failed to load sessions</p>
            <p className="text-xs mt-0.5">{error.message}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {/* Location tabs */}
        <Tabs value={locationFilter} onValueChange={(v) => setLocationFilter(v as LocationFilter)}>
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="archived">Archived</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search input */}
        <div className="flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={handleClearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter
              {statusFilter.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1">
                  {statusFilter.length}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Status</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {(['planning', 'in_progress', 'completed', 'paused'] as const).map((status) => (
              <DropdownMenuItem
                key={status}
                onClick={() => toggleStatusFilter(status)}
                className="justify-between"
              >
                <span className="capitalize">{status.replace('_', ' ')}</span>
                {statusFilter.includes(status) && (
                  <span className="text-primary">&#10003;</span>
                )}
              </DropdownMenuItem>
            ))}
            {hasActiveFilters && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearFilters} className="text-destructive">
                  Clear filters
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Active filters display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">Filters:</span>
          {statusFilter.map((status) => (
            <Badge
              key={status}
              variant="secondary"
              className="cursor-pointer"
              onClick={() => toggleStatusFilter(status)}
            >
              {status.replace('_', ' ')}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          ))}
          {searchQuery && (
            <Badge
              variant="secondary"
              className="cursor-pointer"
              onClick={handleClearSearch}
            >
              Search: {searchQuery}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={clearFilters} className="h-6 text-xs">
            Clear all
          </Button>
        </div>
      )}

      {/* Sessions grid */}
      {isLoading ? (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <SessionCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 border border-dashed border-border rounded-lg">
          <FolderKanban className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-1">
            {hasActiveFilters ? 'No sessions match your filters' : 'No sessions found'}
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            {hasActiveFilters
              ? 'Try adjusting your filters or search query.'
              : 'Create a new session to get started with your workflow.'}
          </p>
          {hasActiveFilters ? (
            <Button variant="outline" onClick={clearFilters}>
              Clear filters
            </Button>
          ) : (
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Session
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {filteredSessions.map((session) => (
            <SessionCard
              key={session.session_id}
              session={session}
              onClick={handleSessionClick}
              onView={handleSessionClick}
              onArchive={handleArchive}
              onDelete={handleDeleteClick}
              actionsDisabled={isMutating}
            />
          ))}
        </div>
      )}

      {/* Create Session Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Session</DialogTitle>
            <DialogDescription>
              Create a new workflow session to track your development tasks.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="sessionId" className="text-sm font-medium">
                Session ID <span className="text-destructive">*</span>
              </label>
              <Input
                id="sessionId"
                placeholder="e.g., WFS-feature-auth"
                value={newSessionId}
                onChange={(e) => setNewSessionId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="sessionTitle" className="text-sm font-medium">
                Title (optional)
              </label>
              <Input
                id="sessionTitle"
                placeholder="e.g., Authentication System"
                value={newSessionTitle}
                onChange={(e) => setNewSessionTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="sessionDescription" className="text-sm font-medium">
                Description (optional)
              </label>
              <Input
                id="sessionDescription"
                placeholder="Brief description of the session"
                value={newSessionDescription}
                onChange={(e) => setNewSessionDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCreateDialogOpen(false);
                resetCreateForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateSession}
              disabled={!newSessionId.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Session'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this session? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setDeleteDialogOpen(false);
                setSessionToDelete(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SessionsPage;
