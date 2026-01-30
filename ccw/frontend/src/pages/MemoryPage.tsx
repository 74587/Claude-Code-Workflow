// ========================================
// Memory Page
// ========================================
// View and manage core memory and context with CRUD operations

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Brain,
  Search,
  Plus,
  Database,
  FileText,
  RefreshCw,
  Trash2,
  Edit,
  Tag,
  Loader2,
  Copy,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { useMemory, useMemoryMutations } from '@/hooks';
import type { CoreMemory } from '@/lib/api';
import { cn } from '@/lib/utils';

// ========== Memory Card Component ==========

interface MemoryCardProps {
  memory: CoreMemory;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: (memory: CoreMemory) => void;
  onDelete: (memory: CoreMemory) => void;
  onCopy: (content: string) => void;
}

function MemoryCard({ memory, isExpanded, onToggleExpand, onEdit, onDelete, onCopy }: MemoryCardProps) {
  const formattedDate = new Date(memory.createdAt).toLocaleDateString();
  const formattedSize = memory.size
    ? memory.size < 1024
      ? `${memory.size} B`
      : `${(memory.size / 1024).toFixed(1)} KB`
    : 'Unknown';

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  {memory.id}
                </span>
                {memory.source && (
                  <Badge variant="outline" className="text-xs">
                    {memory.source}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formattedDate} - {formattedSize}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onCopy(memory.content);
              }}
            >
              <Copy className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(memory);
              }}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(memory);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Preview */}
        {!isExpanded && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
            {memory.content}
          </p>
        )}

        {/* Tags */}
        {memory.tags && memory.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {memory.tags.slice(0, 5).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                <Tag className="w-3 h-3 mr-1" />
                {tag}
              </Badge>
            ))}
            {memory.tags.length > 5 && (
              <Badge variant="secondary" className="text-xs">
                +{memory.tags.length - 5}
              </Badge>
            )}
          </div>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-border p-4 bg-muted/30">
          <pre className="text-sm text-foreground whitespace-pre-wrap font-mono bg-background p-4 rounded-lg overflow-x-auto max-h-96">
            {memory.content}
          </pre>
        </div>
      )}
    </Card>
  );
}

// ========== New Memory Dialog ==========

interface NewMemoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { content: string; tags?: string[] }) => void;
  isCreating: boolean;
  editingMemory?: CoreMemory | null;
}

function NewMemoryDialog({
  open,
  onOpenChange,
  onSubmit,
  isCreating,
  editingMemory,
}: NewMemoryDialogProps) {
  const { formatMessage } = useIntl();
  const [content, setContent] = useState(editingMemory?.content || '');
  const [tagsInput, setTagsInput] = useState(editingMemory?.tags?.join(', ') || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      onSubmit({ content: content.trim(), tags: tags.length > 0 ? tags : undefined });
      setContent('');
      setTagsInput('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editingMemory ? formatMessage({ id: 'memory.createDialog.editTitle' }) : formatMessage({ id: 'memory.createDialog.title' })}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-medium text-foreground">{formatMessage({ id: 'memory.createDialog.labels.content' })}</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={formatMessage({ id: 'memory.createDialog.placeholders.content' })}
              className="mt-1 w-full min-h-[200px] p-3 bg-background border border-input rounded-md text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">{formatMessage({ id: 'memory.createDialog.labels.tags' })}</label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder={formatMessage({ id: 'memory.createDialog.placeholders.tags' })}
              className="mt-1"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {formatMessage({ id: 'memory.createDialog.buttons.cancel' })}
            </Button>
            <Button type="submit" disabled={isCreating || !content.trim()}>
              {isCreating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {editingMemory ? formatMessage({ id: 'memory.createDialog.buttons.updating' }) : formatMessage({ id: 'memory.createDialog.buttons.creating' })}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {editingMemory ? formatMessage({ id: 'memory.createDialog.buttons.update' }) : formatMessage({ id: 'memory.createDialog.buttons.create' })}
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ========== Main Page Component ==========

export function MemoryPage() {
  const { formatMessage } = useIntl();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isNewMemoryOpen, setIsNewMemoryOpen] = useState(false);
  const [editingMemory, setEditingMemory] = useState<CoreMemory | null>(null);
  const [expandedMemories, setExpandedMemories] = useState<Set<string>>(new Set());

  const {
    memories,
    totalSize,
    claudeMdCount,
    allTags,
    isLoading,
    isFetching,
    refetch,
  } = useMemory({
    filter: {
      search: searchQuery || undefined,
      tags: selectedTags.length > 0 ? selectedTags : undefined,
    },
  });

  const { createMemory, updateMemory, deleteMemory, isCreating, isUpdating } =
    useMemoryMutations();

  const toggleExpand = (memoryId: string) => {
    setExpandedMemories((prev) => {
      const next = new Set(prev);
      if (next.has(memoryId)) {
        next.delete(memoryId);
      } else {
        next.add(memoryId);
      }
      return next;
    });
  };

  const handleCreateMemory = async (data: { content: string; tags?: string[] }) => {
    if (editingMemory) {
      await updateMemory(editingMemory.id, data);
      setEditingMemory(null);
    } else {
      await createMemory(data);
    }
    setIsNewMemoryOpen(false);
  };

  const handleEdit = (memory: CoreMemory) => {
    setEditingMemory(memory);
    setIsNewMemoryOpen(true);
  };

  const handleDelete = async (memory: CoreMemory) => {
    if (confirm(`Delete memory "${memory.id}"?`)) {
      await deleteMemory(memory.id);
    }
  };

  const copyToClipboard = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      // TODO: Show toast notification
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const formattedTotalSize = totalSize < 1024
    ? `${totalSize} B`
    : totalSize < 1024 * 1024
      ? `${(totalSize / 1024).toFixed(1)} KB`
      : `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            {formatMessage({ id: 'memory.title' })}
          </h1>
          <p className="text-muted-foreground mt-1">
            {formatMessage({ id: 'memory.description' })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn('w-4 h-4 mr-2', isFetching && 'animate-spin')} />
            {formatMessage({ id: 'common.actions.refresh' })}
          </Button>
          <Button onClick={() => { setEditingMemory(null); setIsNewMemoryOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'memory.actions.add' })}
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Database className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{memories.length}</div>
              <p className="text-sm text-muted-foreground">{formatMessage({ id: 'memory.stats.count' })}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-info/10">
              <FileText className="w-5 h-5 text-info" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{claudeMdCount}</div>
              <p className="text-sm text-muted-foreground">{formatMessage({ id: 'memory.stats.claudeMdCount' })}</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10">
              <Brain className="w-5 h-5 text-success" />
            </div>
            <div>
              <div className="text-2xl font-bold text-foreground">{formattedTotalSize}</div>
              <p className="text-sm text-muted-foreground">{formatMessage({ id: 'memory.stats.totalSize' })}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={formatMessage({ id: 'memory.filters.search' })}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tags Filter */}
        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground py-1">{formatMessage({ id: 'memory.card.tags' })}:</span>
            {allTags.map((tag) => (
              <Button
                key={tag}
                variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                size="sm"
                className="h-7"
                onClick={() => toggleTag(tag)}
              >
                <Tag className="w-3 h-3 mr-1" />
                {tag}
              </Button>
            ))}
            {selectedTags.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => setSelectedTags([])}
              >
                {formatMessage({ id: 'memory.filters.clear' })}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Memory List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : memories.length === 0 ? (
        <Card className="p-8 text-center">
          <Brain className="w-12 h-12 mx-auto text-muted-foreground/50" />
          <h3 className="mt-4 text-lg font-medium text-foreground">
            {formatMessage({ id: 'memory.emptyState.title' })}
          </h3>
          <p className="mt-2 text-muted-foreground">
            {formatMessage({ id: 'memory.emptyState.message' })}
          </p>
          <Button className="mt-4" onClick={() => { setEditingMemory(null); setIsNewMemoryOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            {formatMessage({ id: 'memory.emptyState.createFirst' })}
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {memories.map((memory) => (
            <MemoryCard
              key={memory.id}
              memory={memory}
              isExpanded={expandedMemories.has(memory.id)}
              onToggleExpand={() => toggleExpand(memory.id)}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onCopy={copyToClipboard}
            />
          ))}
        </div>
      )}

      {/* New/Edit Memory Dialog */}
      <NewMemoryDialog
        open={isNewMemoryOpen}
        onOpenChange={(open) => {
          setIsNewMemoryOpen(open);
          if (!open) setEditingMemory(null);
        }}
        onSubmit={handleCreateMemory}
        isCreating={isCreating || isUpdating}
        editingMemory={editingMemory}
      />
    </div>
  );
}

export default MemoryPage;
