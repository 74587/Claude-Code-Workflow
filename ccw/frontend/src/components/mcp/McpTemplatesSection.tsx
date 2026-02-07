// ========================================
// MCP Templates Section Component
// ========================================
// Template management component with card/list view, search input, category filter, save/delete/install actions

import { useState, useEffect, useCallback } from 'react';
import { useIntl } from 'react-intl';
import { useQuery } from '@tanstack/react-query';
import {
  Copy,
  Trash2,
  Download,
  Search,
  Filter,
  Plus,
  FileCode,
  Folder,
  Globe,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/AlertDialog';
import {
  fetchMcpTemplateCategories,
  searchMcpTemplates,
  fetchMcpTemplatesByCategory,
} from '@/lib/api';
import { mcpTemplatesKeys, useDeleteTemplate, useInstallTemplate } from '@/hooks';
import type { McpTemplate } from '@/types/store';

// ========== Types ==========

export interface McpTemplatesSectionProps {
  /** Callback when template is installed (opens McpServerDialog) */
  onInstallTemplate?: (template: McpTemplate) => void;
  /** Callback when saving a new template */
  onSaveAsTemplate?: (name: string, category: string, description: string, serverConfig: { command: string; args: string[]; env: Record<string, string> }) => void;
}

interface TemplateSaveDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (name: string, category: string, description: string, serverConfig: { command: string; args: string[]; env: Record<string, string> }) => void;
  defaultName?: string;
  defaultCommand?: string;
  defaultArgs?: string[];
  defaultEnv?: Record<string, string>;
}

interface TemplateCardProps {
  template: McpTemplate;
  onInstall: (template: McpTemplate) => void;
  onDelete: (templateName: string) => void;
  isInstalling: boolean;
  isDeleting: boolean;
}

// ========== Constants ==========

const SEARCH_DEBOUNCE_MS = 300;

// ========== Helper Components ==========

/**
 * Template Card Component - Display single template with actions
 */
function TemplateCard({ template, onInstall, onDelete, isInstalling, isDeleting }: TemplateCardProps) {
  const { formatMessage } = useIntl();

  const handleInstall = () => {
    onInstall(template);
  };

  const handleDelete = () => {
    onDelete(template.name);
  };

  // Get icon based on category
  const getCategoryIcon = () => {
    const iconProps = { className: 'w-4 h-4' };
    switch (template.category?.toLowerCase()) {
      case 'stdio':
      case 'transport':
        return <FileCode {...iconProps} />;
      case 'language':
      case 'python':
      case 'node':
        return <Folder {...iconProps} />;
      case 'official':
      case 'builtin':
        return <Globe {...iconProps} />;
      default:
        return <Copy {...iconProps} />;
    }
  };

  return (
    <Card className="p-4 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="p-2 rounded-lg bg-muted flex-shrink-0">
            {getCategoryIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground truncate">
                {template.name}
              </span>
              {template.category && (
                <Badge variant="secondary" className="text-xs">
                  {template.category}
                </Badge>
              )}
            </div>
            {template.description && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                {template.description}
              </p>
            )}
            <div className="flex items-center gap-2 mt-2">
              <code className="text-xs bg-muted px-2 py-1 rounded font-mono truncate max-w-[150px]">
                {template.serverConfig.command}
              </code>
              {template.serverConfig.args && template.serverConfig.args.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {template.serverConfig.args.length} args
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleInstall}
            disabled={isInstalling}
            title={formatMessage({ id: 'mcp.templates.actions.install' })}
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={isDeleting}
            title={formatMessage({ id: 'mcp.templates.actions.delete' })}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Template Save Dialog - Save current server configuration as template
 */
export function TemplateSaveDialog({
  open,
  onClose,
  onSave,
  defaultName = '',
  defaultCommand = '',
  defaultArgs = [],
  defaultEnv = {},
}: TemplateSaveDialogProps) {
  const { formatMessage } = useIntl();

  const [name, setName] = useState(defaultName);
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [command, setCommand] = useState(defaultCommand);
  const [argsInput, setArgsInput] = useState(defaultArgs.join(', '));
  const [envInput, setEnvInput] = useState(
    Object.entries(defaultEnv).map(([k, v]) => `${k}=${v}`).join('\n')
  );
  const [errors, setErrors] = useState<{ name?: string; command?: string }>({});

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setName(defaultName || '');
      setCategory('');
      setDescription('');
      setCommand(defaultCommand || '');
      setArgsInput((defaultArgs || []).join(', '));
      setEnvInput(
        Object.entries(defaultEnv || {}).map(([k, v]) => `${k}=${v}`).join('\n')
      );
      setErrors({});
    }
  }, [open, defaultName, defaultCommand, defaultArgs, defaultEnv]);

  const handleSave = () => {
    const newErrors: { name?: string; command?: string } = {};
    if (!name.trim()) {
      newErrors.name = formatMessage({ id: 'mcp.templates.saveDialog.validation.nameRequired' });
    }
    if (!command.trim()) {
      newErrors.command = formatMessage({ id: 'mcp.dialog.validation.commandRequired' });
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const args = argsInput
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    const env: Record<string, string> = {};
    for (const line of envInput.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes('=')) {
        const [key, ...valParts] = trimmed.split('=');
        if (key) env[key.trim()] = valParts.join('=').trim();
      }
    }

    onSave(name.trim(), category.trim(), description.trim(), {
      command: command.trim(),
      args,
      env,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {formatMessage({ id: 'mcp.templates.saveDialog.title' })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'mcp.templates.saveDialog.name' })}
              <span className="text-destructive ml-1">*</span>
            </label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
              }}
              placeholder={formatMessage({ id: 'mcp.templates.saveDialog.namePlaceholder' })}
              error={!!errors.name}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          {/* Command */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'mcp.dialog.form.command' })}
              <span className="text-destructive ml-1">*</span>
            </label>
            <Input
              value={command}
              onChange={(e) => {
                setCommand(e.target.value);
                if (errors.command) setErrors((prev) => ({ ...prev, command: undefined }));
              }}
              placeholder={formatMessage({ id: 'mcp.dialog.form.commandPlaceholder' })}
              error={!!errors.command}
            />
            {errors.command && (
              <p className="text-sm text-destructive">{errors.command}</p>
            )}
          </div>

          {/* Args */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'mcp.dialog.form.args' })}
            </label>
            <Input
              value={argsInput}
              onChange={(e) => setArgsInput(e.target.value)}
              placeholder={formatMessage({ id: 'mcp.dialog.form.argsPlaceholder' })}
            />
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'mcp.dialog.form.argsHint' })}
            </p>
          </div>

          {/* Environment Variables */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'mcp.dialog.form.env' })}
            </label>
            <textarea
              value={envInput}
              onChange={(e) => setEnvInput(e.target.value)}
              placeholder={formatMessage({ id: 'mcp.dialog.form.envPlaceholder' })}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'mcp.templates.saveDialog.category' })}
            </label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={formatMessage({ id: 'mcp.templates.saveDialog.categoryPlaceholder' })} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stdio">STDIO</SelectItem>
                <SelectItem value="sse">SSE</SelectItem>
                <SelectItem value="language">Language</SelectItem>
                <SelectItem value="official">Official</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'mcp.templates.saveDialog.description' })}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={formatMessage({ id: 'mcp.templates.saveDialog.descriptionPlaceholder' })}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {formatMessage({ id: 'mcp.templates.saveDialog.cancel' })}
          </Button>
          <Button onClick={handleSave}>
            {formatMessage({ id: 'mcp.templates.saveDialog.save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ========== Main Component ==========

/**
 * McpTemplatesSection - Main template management component
 *
 * Features:
 * - Template list view with search and category filter
 * - Install template action (populates McpServerDialog)
 * - Delete template with confirmation
 * - Save current server as template
 */
export function McpTemplatesSection({ onInstallTemplate, onSaveAsTemplate }: McpTemplatesSectionProps) {
  const { formatMessage } = useIntl();

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  // Fetch categories for filter dropdown
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: mcpTemplatesKeys.categories(),
    queryFn: fetchMcpTemplateCategories,
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Mutations
  const deleteMutation = useDeleteTemplate();
  const installMutation = useInstallTemplate();

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch templates based on search and category filter
  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: mcpTemplatesKeys.list(selectedCategory === 'all' ? undefined : selectedCategory),
    queryFn: async () => {
      if (debouncedSearch.trim()) {
        return searchMcpTemplates(debouncedSearch.trim());
      } else if (selectedCategory === 'all') {
        // Fetch all templates by iterating categories
        const allTemplates: McpTemplate[] = [];
        for (const category of categories) {
          const categoryTemplates = await fetchMcpTemplatesByCategory(category);
          allTemplates.push(...categoryTemplates);
        }
        return allTemplates;
      } else {
        return fetchMcpTemplatesByCategory(selectedCategory);
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !categoriesLoading,
  });

  // Handlers
  const handleInstallTemplate = useCallback((template: McpTemplate) => {
    // Call parent callback to open McpServerDialog with template data
    onInstallTemplate?.(template);
  }, [onInstallTemplate]);

  const handleDeleteClick = useCallback((templateName: string) => {
    setTemplateToDelete(templateName);
    setDeleteConfirmOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!templateToDelete) return;

    const result = await deleteMutation.deleteTemplate(templateToDelete);
    if (result.success) {
      setDeleteConfirmOpen(false);
      setTemplateToDelete(null);
    }
  }, [templateToDelete, deleteMutation]);

  const handleSaveTemplate = useCallback((_name: string, _category: string, _description: string, _serverConfig: { command: string; args: string[]; env: Record<string, string> }) => {
    onSaveAsTemplate?.(_name, _category, _description, _serverConfig);
    setSaveDialogOpen(false);
  }, [onSaveAsTemplate]);

  return (
    <div className="space-y-4">
      {/* Header with search and filter */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={formatMessage({ id: 'mcp.templates.searchPlaceholder' })}
              className="pl-9"
            />
          </div>

          {/* Category Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {formatMessage({ id: 'mcp.templates.filter.allCategories' })}
                </SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Save Template Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSaveDialogOpen(true)}
        >
          <Plus className="w-4 h-4 mr-1" />
          {formatMessage({ id: 'mcp.templates.actions.saveAsTemplate' })}
        </Button>
      </div>

      {/* Template List */}
      {templatesLoading ? (
        <div className="flex items-center justify-center py-12">
          <p className="text-sm text-muted-foreground">
            {formatMessage({ id: 'mcp.templates.loading' })}
          </p>
        </div>
      ) : templates.length === 0 ? (
        <Card className="p-12 text-center">
          <Copy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">
            {formatMessage({ id: 'mcp.templates.empty.title' })}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {formatMessage({ id: 'mcp.templates.empty.message' })}
          </p>
          <Button onClick={() => setSaveDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" />
            {formatMessage({ id: 'mcp.templates.empty.createFirst' })}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {templates.map((template) => (
            <TemplateCard
              key={template.name}
              template={template}
              onInstall={handleInstallTemplate}
              onDelete={handleDeleteClick}
              isInstalling={installMutation.isInstalling}
              isDeleting={deleteMutation.isDeleting}
            />
          ))}
        </div>
      )}

      {/* Save Template Dialog */}
      <TemplateSaveDialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        onSave={handleSaveTemplate}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {formatMessage({ id: 'mcp.templates.deleteDialog.title' })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {formatMessage(
                { id: 'mcp.templates.deleteDialog.message' },
                { name: templateToDelete }
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {formatMessage({ id: 'mcp.templates.deleteDialog.cancel' })}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isDeleting
                ? formatMessage({ id: 'mcp.templates.deleteDialog.deleting' })
                : formatMessage({ id: 'mcp.templates.deleteDialog.delete' })
              }
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default McpTemplatesSection;
