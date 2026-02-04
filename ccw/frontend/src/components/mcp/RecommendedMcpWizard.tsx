// ========================================
// Recommended MCP Wizard Component
// ========================================
// Dynamic configuration wizard for recommended MCP servers
// Supports text, password, and multi-select field types

import { useState } from 'react';
import { useIntl } from 'react-intl';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Download, Loader2, Search, Globe, Sparkles, Settings } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  addGlobalMcpServer,
  copyMcpServerToProject,
} from '@/lib/api';
import { mcpServersKeys } from '@/hooks';
import { useNotifications } from '@/hooks/useNotifications';
import { cn } from '@/lib/utils';

// Icon map for MCP definitions
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  'search-code': Search,
  'chrome': Globe,
  'globe-2': Sparkles,
  'code-2': Settings,
};

// ========== Types ==========

/**
 * Field definition for wizard
 */
export interface WizardField {
  key: string;
  labelKey: string;
  descKey?: string;
  type: 'text' | 'password' | 'multi-select';
  default?: string | string[];
  placeholder?: string;
  required?: boolean;
  options?: Array<{
    value: string;
    label: string;
    desc?: string;
  }>;
}

/**
 * Recommended MCP server definition
 */
export interface RecommendedMcpDefinition {
  id: string;
  nameKey: string;
  descKey: string;
  icon: string;
  category: string;
  fields: WizardField[];
  buildConfig: (values: Record<string, any>) => {
    command: string;
    args: string[];
    env?: Record<string, string>;
    type?: string;
  };
}

/**
 * Props for RecommendedMcpWizard component
 */
export interface RecommendedMcpWizardProps {
  open: boolean;
  onClose: () => void;
  mcpDefinition: RecommendedMcpDefinition | null;
  onInstallComplete?: () => void;
}

// ========== Main Component ==========

/**
 * Wizard for installing recommended MCP servers with configuration
 */
export function RecommendedMcpWizard({
  open,
  onClose,
  mcpDefinition,
  onInstallComplete,
}: RecommendedMcpWizardProps) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const { success: showSuccess, error: showError } = useNotifications();

  // State for field values
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [selectedScope, setSelectedScope] = useState<'project' | 'global'>('global');

  // Initialize field values when dialog opens
  const initializeFieldValues = () => {
    if (!mcpDefinition) return;

    const initialValues: Record<string, any> = {};
    for (const field of mcpDefinition.fields) {
      if (field.default !== undefined) {
        initialValues[field.key] = field.default;
      } else if (field.type === 'multi-select') {
        initialValues[field.key] = [];
      } else {
        initialValues[field.key] = '';
      }
    }
    setFieldValues(initialValues);
  };

  // Reset on open/close
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && mcpDefinition) {
      initializeFieldValues();
    } else {
      setFieldValues({});
      onClose();
    }
  };

  // Install mutation
  const installMutation = useMutation({
    mutationFn: async () => {
      if (!mcpDefinition) throw new Error('No MCP definition');

      const serverConfig = mcpDefinition.buildConfig(fieldValues);

      if (selectedScope === 'global') {
        return addGlobalMcpServer(mcpDefinition.id, serverConfig);
      } else {
        return copyMcpServerToProject(mcpDefinition.id, serverConfig);
      }
    },
    onSuccess: (result) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: mcpServersKeys.all });
        showSuccess(
          formatMessage({ id: 'mcp.wizard.installSuccess' }),
          formatMessage({ id: mcpDefinition!.nameKey })
        );
        handleOpenChange(false);
        onInstallComplete?.();
      } else {
        showError(
          formatMessage({ id: 'mcp.wizard.installError' }),
          result.error || 'Unknown error'
        );
      }
    },
    onError: (err: Error) => {
      showError(
        formatMessage({ id: 'mcp.wizard.installError' }),
        err.message
      );
    },
  });

  // Handle field value change
  const handleFieldChange = (key: string, value: any) => {
    setFieldValues(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Handle multi-select toggle
  const handleMultiSelectToggle = (key: string, value: string) => {
    const current = fieldValues[key] || [];
    const newValue = current.includes(value)
      ? current.filter((v: string) => v !== value)
      : [...current, value];
    handleFieldChange(key, newValue);
  };

  // Validate required fields
  const validateFields = (): boolean => {
    if (!mcpDefinition) return false;

    for (const field of mcpDefinition.fields) {
      if (field.required) {
        const value = fieldValues[field.key];
        if (field.type === 'multi-select') {
          if (!value || value.length === 0) return false;
        } else {
          if (!value || value.trim() === '') return false;
        }
      }
    }
    return true;
  };

  // Handle submit
  const handleSubmit = () => {
    if (!validateFields()) {
      showError(
        formatMessage({ id: 'mcp.wizard.validation' }),
        formatMessage({ id: 'mcp.wizard.requiredFields' })
      );
      return;
    }
    installMutation.mutate();
  };

  if (!mcpDefinition) return null;

  const hasFields = mcpDefinition.fields.length > 0;
  const Icon = ICON_MAP[mcpDefinition.icon] || Settings;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Icon className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>
                {formatMessage({ id: 'mcp.wizard.install' })} {formatMessage({ id: mcpDefinition.nameKey })}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {formatMessage({ id: mcpDefinition.descKey })}
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="space-y-4 py-4">
          {/* Fields */}
          {hasFields && (
            <div className="space-y-3">
              {mcpDefinition.fields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    {formatMessage({ id: field.labelKey })}
                    {field.required && <span className="text-destructive">*</span>}
                  </Label>
                  {field.descKey && (
                    <p className="text-xs text-muted-foreground">
                      {formatMessage({ id: field.descKey })}
                    </p>
                  )}

                  {/* Text/Password Input */}
                  {(field.type === 'text' || field.type === 'password') && (
                    <Input
                      type={field.type}
                      value={fieldValues[field.key] || ''}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={field.placeholder}
                      className="font-mono text-sm"
                    />
                  )}

                  {/* Multi-Select */}
                  {field.type === 'multi-select' && field.options && (
                    <div className="space-y-2 p-2 bg-muted/30 border border-border rounded-lg max-h-48 overflow-y-auto">
                      {field.options.map((option) => {
                        const isSelected = (fieldValues[field.key] || []).includes(option.value);
                        return (
                          <div
                            key={option.value}
                            className={cn(
                              'flex items-start gap-2 p-2 rounded transition-colors cursor-pointer',
                              isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                            )}
                            onClick={() => handleMultiSelectToggle(field.key, option.value)}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="mt-0.5 w-4 h-4"
                            />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-foreground">
                                {option.label}
                              </div>
                              {option.desc && (
                                <div className="text-xs text-muted-foreground">
                                  {option.desc}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Scope Selection */}
          <div className="space-y-2 pt-3 border-t border-border">
            <Label className="text-sm font-medium">
              {formatMessage({ id: 'mcp.wizard.scope' })}
            </Label>
            <div className="flex gap-2">
              <Button
                variant={selectedScope === 'global' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedScope('global')}
                className="flex-1"
              >
                {formatMessage({ id: 'mcp.wizard.scope.global' })}
              </Button>
              <Button
                variant={selectedScope === 'project' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedScope('project')}
                className="flex-1"
              >
                {formatMessage({ id: 'mcp.wizard.scope.project' })}
              </Button>
            </div>
          </div>

          {/* No Configuration Needed Message */}
          {!hasFields && (
            <div className="p-3 bg-success/10 border border-success/20 rounded-lg text-sm text-success">
              {formatMessage({ id: 'mcp.noConfigNeeded' })}
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={installMutation.isPending}
          >
            {formatMessage({ id: 'mcp.dialog.actions.cancel' })}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={installMutation.isPending}
          >
            {installMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                {formatMessage({ id: 'mcp.wizard.installing' })}
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-1" />
                {formatMessage({ id: 'mcp.wizard.install' })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RecommendedMcpWizard;
