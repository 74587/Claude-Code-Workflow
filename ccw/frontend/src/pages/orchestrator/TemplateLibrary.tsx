// ========================================
// Template Library
// ========================================
// Template browser with import/export functionality

import { useState, useCallback, useMemo } from 'react';
import {
  Library,
  Search,
  Download,
  Upload,
  Grid,
  List,
  Tag,
  Calendar,
  FileText,
  GitBranch,
  Loader2,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { useTemplates, useInstallTemplate, useExportTemplate, useDeleteTemplate } from '@/hooks/useTemplates';
import { useFlowStore } from '@/stores';
import type { FlowTemplate } from '@/types/execution';

// ========== Helper Functions ==========

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

// ========== Template Card Component ==========

interface TemplateCardProps {
  template: FlowTemplate;
  viewMode: 'grid' | 'list';
  onInstall: (template: FlowTemplate) => void;
  onDelete: (template: FlowTemplate) => void;
  isInstalling: boolean;
  isDeleting: boolean;
}

function TemplateCard({
  template,
  viewMode,
  onInstall,
  onDelete,
  isInstalling,
  isDeleting,
}: TemplateCardProps) {
  const isGrid = viewMode === 'grid';

  return (
    <Card
      className={cn(
        'hover:border-primary/50 transition-colors',
        isGrid ? '' : 'flex items-center'
      )}
    >
      {isGrid ? (
        <>
          {/* Grid view */}
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <CardTitle className="text-base truncate" title={template.name}>
                {template.name}
              </CardTitle>
              {template.category && (
                <Badge variant="secondary" className="text-xs shrink-0">
                  {template.category}
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {template.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {template.description}
              </p>
            )}

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {template.nodeCount} nodes
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(template.updated_at)}
              </span>
            </div>

            {template.tags && template.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {template.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    <Tag className="h-2 w-2 mr-1" />
                    {tag}
                  </Badge>
                ))}
                {template.tags.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{template.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                size="sm"
                variant="default"
                className="flex-1"
                onClick={() => onInstall(template)}
                disabled={isInstalling}
              >
                {isInstalling ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Import
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(template)}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </>
      ) : (
        <>
          {/* List view */}
          <div className="flex-1 flex items-center gap-4 p-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium truncate">{template.name}</span>
                {template.category && (
                  <Badge variant="secondary" className="text-xs shrink-0">
                    {template.category}
                  </Badge>
                )}
              </div>
              {template.description && (
                <p className="text-sm text-muted-foreground truncate">
                  {template.description}
                </p>
              )}
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
              <span className="flex items-center gap-1">
                <GitBranch className="h-3 w-3" />
                {template.nodeCount}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDate(template.updated_at)}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="default"
                onClick={() => onInstall(template)}
                disabled={isInstalling}
              >
                {isInstalling ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onDelete(template)}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

// ========== Export Dialog Component ==========

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (name: string, description: string, category: string, tags: string[]) => void;
  isExporting: boolean;
  flowName: string;
}

function ExportDialog({
  open,
  onOpenChange,
  onExport,
  isExporting,
  flowName,
}: ExportDialogProps) {
  const [name, setName] = useState(flowName);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tagsInput, setTagsInput] = useState('');

  const handleExport = useCallback(() => {
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    onExport(name, description, category, tags);
  }, [name, description, category, tagsInput, onExport]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Export as Template</DialogTitle>
          <DialogDescription>
            Save this flow as a reusable template in your library.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this template"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Input
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g., Development, Testing, Deployment"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Tags (comma-separated)</label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="e.g., react, testing, ci/cd"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleExport} disabled={!name.trim() || isExporting}>
            {isExporting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Upload className="h-4 w-4 mr-1" />
            )}
            Export
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========== Main Component ==========

interface TemplateLibraryProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TemplateLibrary({ open, onOpenChange }: TemplateLibraryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Flow store
  const currentFlow = useFlowStore((state) => state.currentFlow);
  const setCurrentFlow = useFlowStore((state) => state.setCurrentFlow);

  // Query hooks
  const { data, isLoading, error } = useTemplates(selectedCategory ?? undefined);

  // Mutation hooks
  const installTemplate = useInstallTemplate();
  const exportTemplate = useExportTemplate();
  const deleteTemplate = useDeleteTemplate();

  // Filter templates by search query
  const filteredTemplates = useMemo(() => {
    if (!data?.templates) return [];
    if (!searchQuery.trim()) return data.templates;

    const query = searchQuery.toLowerCase();
    return data.templates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query) ||
        t.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  }, [data?.templates, searchQuery]);

  // Handle install
  const handleInstall = useCallback(
    async (template: FlowTemplate) => {
      setInstallingId(template.id);
      try {
        const result = await installTemplate.mutateAsync({
          templateId: template.id,
        });
        // Set the installed flow as current
        setCurrentFlow(result.flow);
        onOpenChange(false);
      } catch (error) {
        console.error('Failed to install template:', error);
      } finally {
        setInstallingId(null);
      }
    },
    [installTemplate, setCurrentFlow, onOpenChange]
  );

  // Handle export
  const handleExport = useCallback(
    async (name: string, description: string, category: string, tags: string[]) => {
      if (!currentFlow) return;

      try {
        await exportTemplate.mutateAsync({
          flowId: currentFlow.id,
          name,
          description,
          category,
          tags,
        });
        setExportDialogOpen(false);
      } catch (error) {
        console.error('Failed to export template:', error);
      }
    },
    [currentFlow, exportTemplate]
  );

  // Handle delete
  const handleDelete = useCallback(
    async (template: FlowTemplate) => {
      setDeletingId(template.id);
      try {
        await deleteTemplate.mutateAsync(template.id);
      } catch (error) {
        console.error('Failed to delete template:', error);
      } finally {
        setDeletingId(null);
      }
    },
    [deleteTemplate]
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Library className="h-5 w-5" />
              Template Library
            </DialogTitle>
            <DialogDescription>
              Browse and import workflow templates, or export your current flow as a template.
            </DialogDescription>
          </DialogHeader>

          {/* Toolbar */}
          <div className="flex items-center gap-4 py-2">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="pl-9"
              />
            </div>

            {/* Category filter */}
            {data?.categories && data.categories.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  variant={selectedCategory === null ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedCategory(null)}
                >
                  All
                </Button>
                {data.categories.slice(0, 4).map((cat) => (
                  <Button
                    key={cat}
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            )}

            {/* View mode toggle */}
            <div className="flex items-center border border-border rounded-md">
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-r-none"
                onClick={() => setViewMode('grid')}
              >
                <Grid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-l-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Export button */}
            {currentFlow && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setExportDialogOpen(true)}
              >
                <Upload className="h-4 w-4 mr-1" />
                Export Current
              </Button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <FileText className="h-12 w-12 mb-2" />
                <p>Failed to load templates</p>
                <p className="text-sm">{(error as Error).message}</p>
              </div>
            ) : filteredTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
                <Library className="h-12 w-12 mb-2" />
                <p>No templates found</p>
                {searchQuery && (
                  <p className="text-sm">Try a different search query</p>
                )}
              </div>
            ) : (
              <div
                className={cn(
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                    : 'space-y-2'
                )}
              >
                {filteredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    viewMode={viewMode}
                    onInstall={handleInstall}
                    onDelete={handleDelete}
                    isInstalling={installingId === template.id}
                    isDeleting={deletingId === template.id}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="border-t border-border pt-4">
            <div className="flex items-center justify-between w-full">
              <span className="text-sm text-muted-foreground">
                {filteredTemplates.length} template{filteredTemplates.length !== 1 ? 's' : ''}
              </span>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      {currentFlow && (
        <ExportDialog
          open={exportDialogOpen}
          onOpenChange={setExportDialogOpen}
          onExport={handleExport}
          isExporting={exportTemplate.isPending}
          flowName={currentFlow.name}
        />
      )}
    </>
  );
}

export default TemplateLibrary;
