// ========================================
// MCP Server Dialog Component
// ========================================
// Add/Edit dialog for MCP server configuration with dynamic template loading

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  createMcpServer,
  updateMcpServer,
  fetchMcpServers,
  type McpServer,
} from '@/lib/api';
import { mcpServersKeys, useMcpTemplates } from '@/hooks';
import { cn } from '@/lib/utils';
import { ConfigTypeToggle, type McpConfigType } from './ConfigTypeToggle';

// ========== Types ==========

export interface McpServerDialogProps {
  mode: 'add' | 'edit';
  server?: McpServer;
  open: boolean;
  onClose: () => void;
  onSave?: () => void;
}

// Re-export McpTemplate for convenience
export type { McpTemplate } from '@/types/store';

interface McpServerFormData {
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  scope: 'project' | 'global';
  enabled: boolean;
}

interface FormErrors {
  name?: string;
  command?: string;
  args?: string;
  env?: string;
}

// ========== Component ==========

export function McpServerDialog({
  mode,
  server,
  open,
  onClose,
  onSave,
}: McpServerDialogProps) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();

  // Fetch templates from backend
  const { templates, isLoading: templatesLoading } = useMcpTemplates();

  // Form state
  const [formData, setFormData] = useState<McpServerFormData>({
    name: '',
    command: '',
    args: [],
    env: {},
    scope: 'project',
    enabled: true,
  });

  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [argsInput, setArgsInput] = useState('');
  const [envInput, setEnvInput] = useState('');
  const [configType, setConfigType] = useState<McpConfigType>('mcp-json');

  // Initialize form from server prop (edit mode)
  useEffect(() => {
    if (server && mode === 'edit') {
      setFormData({
        name: server.name,
        command: server.command,
        args: server.args || [],
        env: server.env || {},
        scope: server.scope,
        enabled: server.enabled,
      });
      setArgsInput((server.args || []).join(', '));
      setEnvInput(
        Object.entries(server.env || {})
          .map(([k, v]) => `${k}=${v}`)
          .join('\n')
      );
    } else {
      // Reset form for add mode
      setFormData({
        name: '',
        command: '',
        args: [],
        env: {},
        scope: 'project',
        enabled: true,
      });
      setArgsInput('');
      setEnvInput('');
    }
    setSelectedTemplate('');
    setErrors({});
  }, [server, mode, open]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: Omit<McpServer, 'name'>) => createMcpServer(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
      handleClose();
      onSave?.();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ serverName, config }: { serverName: string; config: Partial<McpServer> }) =>
      updateMcpServer(serverName, config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
      handleClose();
      onSave?.();
    },
  });

  // Handlers
  const handleClose = () => {
    setErrors({});
    onClose();
  };

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find((t) => t.name === templateId);
    if (template) {
      setFormData((prev) => ({
        ...prev,
        command: template.serverConfig.command,
        args: template.serverConfig.args || [],
        env: template.serverConfig.env || {},
      }));
      setArgsInput((template.serverConfig.args || []).join(', '));
      setEnvInput(
        Object.entries(template.serverConfig.env || {})
          .map(([k, v]) => `${k}=${v}`)
          .join('\n')
      );
      setSelectedTemplate(templateId);
    }
  };

  const handleFieldChange = (
    field: keyof McpServerFormData,
    value: string | boolean | string[] | Record<string, string>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleArgsChange = (value: string) => {
    setArgsInput(value);
    const argsArray = value
      .split(',')
      .map((a) => a.trim())
      .filter((a) => a.length > 0);
    setFormData((prev) => ({ ...prev, args: argsArray }));
    if (errors.args) {
      setErrors((prev) => ({ ...prev, args: undefined }));
    }
  };

  const handleEnvChange = (value: string) => {
    setEnvInput(value);
    const envObj: Record<string, string> = {};
    const lines = value.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && trimmed.includes('=')) {
        const [key, ...valParts] = trimmed.split('=');
        const val = valParts.join('=');
        if (key) {
          envObj[key.trim()] = val.trim();
        }
      }
    }
    setFormData((prev) => ({ ...prev, env: envObj }));
    if (errors.env) {
      setErrors((prev) => ({ ...prev, env: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Name required
    if (!formData.name.trim()) {
      newErrors.name = formatMessage({ id: 'mcp.dialog.validation.nameRequired' });
    }

    // Command required
    if (!formData.command.trim()) {
      newErrors.command = formatMessage({ id: 'mcp.dialog.validation.commandRequired' });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkNameExists = async (name: string): Promise<boolean> => {
    try {
      const data = await fetchMcpServers();
      const allServers = [...data.project, ...data.global];
      // In edit mode, exclude current server
      return allServers.some(
        (s) => s.name === name && (mode === 'edit' ? s.name !== server?.name : true)
      );
    } catch {
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    // Check name uniqueness
    if (await checkNameExists(formData.name)) {
      setErrors({ name: formatMessage({ id: 'mcp.dialog.validation.nameExists' }) });
      return;
    }

    if (mode === 'add') {
      createMutation.mutate({
        command: formData.command,
        args: formData.args,
        env: formData.env,
        scope: formData.scope,
        enabled: formData.enabled,
      });
    } else {
      updateMutation.mutate({
        serverName: server!.name,
        config: {
          command: formData.command,
          args: formData.args,
          env: formData.env,
          scope: formData.scope,
          enabled: formData.enabled,
        },
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'add'
              ? formatMessage({ id: 'mcp.dialog.addTitle' })
              : formatMessage({ id: 'mcp.dialog.editTitle' }, { name: server?.name })}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'mcp.dialog.form.template' })}
            </label>
            <Select value={selectedTemplate} onValueChange={handleTemplateSelect} disabled={templatesLoading}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={templatesLoading
                    ? formatMessage({ id: 'mcp.templates.loading' })
                    : formatMessage({ id: 'mcp.dialog.form.templatePlaceholder' })
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {templates.length === 0 ? (
                  <SelectItem value="" disabled>
                    {formatMessage({ id: 'mcp.templates.empty.title' })}
                  </SelectItem>
                ) : (
                  templates.map((template) => (
                    <SelectItem key={template.name} value={template.name}>
                      <div className="flex flex-col">
                        <span className="font-medium">{template.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {template.description || formatMessage({ id: 'mcp.dialog.form.templatePlaceholder' })}
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'mcp.dialog.form.name' })}
              <span className="text-destructive ml-1">*</span>
            </label>
            <Input
              value={formData.name}
              onChange={(e) => handleFieldChange('name', e.target.value)}
              placeholder={formatMessage({ id: 'mcp.dialog.form.namePlaceholder' })}
              error={!!errors.name}
              disabled={mode === 'edit'} // Name cannot be changed in edit mode
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
              value={formData.command}
              onChange={(e) => handleFieldChange('command', e.target.value)}
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
              onChange={(e) => handleArgsChange(e.target.value)}
              placeholder={formatMessage({ id: 'mcp.dialog.form.argsPlaceholder' })}
              error={!!errors.args}
            />
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'mcp.dialog.form.argsHint' })}
            </p>
            {formData.args.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.args.map((arg, idx) => (
                  <Badge key={idx} variant="secondary" className="font-mono text-xs">
                    {arg}
                  </Badge>
                ))}
              </div>
            )}
            {errors.args && (
              <p className="text-sm text-destructive">{errors.args}</p>
            )}
          </div>

          {/* Environment Variables */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'mcp.dialog.form.env' })}
            </label>
            <textarea
              value={envInput}
              onChange={(e) => handleEnvChange(e.target.value)}
              placeholder={formatMessage({ id: 'mcp.dialog.form.envPlaceholder' })}
              className={cn(
                'flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
                errors.env && 'border-destructive focus-visible:ring-destructive'
              )}
            />
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'mcp.dialog.form.envHint' })}
            </p>
            {Object.keys(formData.env).length > 0 && (
              <div className="space-y-1 mt-2">
                {Object.entries(formData.env).map(([key, value]) => (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="font-mono">
                      {key}
                    </Badge>
                    <span className="text-muted-foreground">=</span>
                    <code className="text-xs bg-muted px-2 py-1 rounded flex-1 overflow-x-auto">
                      {value}
                    </code>
                  </div>
                ))}
              </div>
            )}
            {errors.env && (
              <p className="text-sm text-destructive">{errors.env}</p>
            )}
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              {formatMessage({ id: 'mcp.dialog.form.scope' })}
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="project"
                  checked={formData.scope === 'project'}
                  onChange={(e) => handleFieldChange('scope', e.target.value as 'project' | 'global')}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  {formatMessage({ id: 'mcp.scope.project' })}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  value="global"
                  checked={formData.scope === 'global'}
                  onChange={(e) => handleFieldChange('scope', e.target.value as 'project' | 'global')}
                  className="w-4 h-4"
                />
                <span className="text-sm">
                  {formatMessage({ id: 'mcp.scope.global' })}
                </span>
              </label>
            </div>

            {/* Config Type Toggle - Only for project scope */}
            {formData.scope === 'project' && (
              <div className="flex items-center gap-2 mt-2 pl-6">
                <span className="text-xs text-muted-foreground">
                  {formatMessage({ id: 'mcp.configType.format' })}:
                </span>
                <ConfigTypeToggle
                  currentType={configType}
                  onTypeChange={setConfigType}
                  showWarning={false}
                />
              </div>
            )}
          </div>

          {/* Enabled */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="enabled"
              checked={formData.enabled}
              onChange={(e) => handleFieldChange('enabled', e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="enabled" className="text-sm font-medium text-foreground cursor-pointer">
              {formatMessage({ id: 'mcp.dialog.form.enabled' })}
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isPending}
          >
            {formatMessage({ id: 'mcp.dialog.actions.cancel' })}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending
              ? formatMessage({ id: 'mcp.dialog.actions.saving' })
              : formatMessage({ id: 'mcp.dialog.actions.save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default McpServerDialog;
