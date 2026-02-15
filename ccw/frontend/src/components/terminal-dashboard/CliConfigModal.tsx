// ========================================
// CliConfigModal Component
// ========================================
// Config modal for creating a new CLI session in Terminal Dashboard.

import * as React from 'react';
import { useIntl } from 'react-intl';
import { FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';

export type CliTool = 'claude' | 'gemini' | 'qwen' | 'codex' | 'opencode';
export type LaunchMode = 'default' | 'yolo';
export type ShellKind = 'bash' | 'pwsh';

export interface CliSessionConfig {
  tool: CliTool;
  model?: string;
  launchMode: LaunchMode;
  preferredShell: ShellKind;
  workingDir: string;
}

export interface CliConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultWorkingDir?: string | null;
  onCreateSession: (config: CliSessionConfig) => Promise<void>;
}

const CLI_TOOLS: CliTool[] = ['claude', 'gemini', 'qwen', 'codex', 'opencode'];

const MODEL_OPTIONS: Record<CliTool, string[]> = {
  claude: ['sonnet', 'haiku'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash'],
  qwen: ['coder-model'],
  codex: ['gpt-5.2'],
  opencode: ['opencode/glm-4.7-free'],
};

const AUTO_MODEL_VALUE = '__auto__';

export function CliConfigModal({
  isOpen,
  onClose,
  defaultWorkingDir,
  onCreateSession,
}: CliConfigModalProps) {
  const { formatMessage } = useIntl();

  const [tool, setTool] = React.useState<CliTool>('gemini');
  const [model, setModel] = React.useState<string | undefined>(MODEL_OPTIONS.gemini[0]);
  const [launchMode, setLaunchMode] = React.useState<LaunchMode>('yolo');
  const [preferredShell, setPreferredShell] = React.useState<ShellKind>('bash');
  const [workingDir, setWorkingDir] = React.useState<string>(defaultWorkingDir ?? '');

  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const modelOptions = React.useMemo(() => MODEL_OPTIONS[tool] ?? [], [tool]);

  React.useEffect(() => {
    if (!isOpen) return;
    // Reset to a safe default each time the modal is opened.
    const nextWorkingDir = defaultWorkingDir ?? '';
    setWorkingDir(nextWorkingDir);
    setError(null);
  }, [isOpen, defaultWorkingDir]);

  const handleToolChange = (nextTool: string) => {
    const next = nextTool as CliTool;
    setTool(next);
    const nextModels = MODEL_OPTIONS[next] ?? [];
    if (!model || !nextModels.includes(model)) {
      setModel(nextModels[0]);
    }
  };

  const handleBrowse = () => {
    // Reserved for future file-picker integration
    console.log('[CliConfigModal] browse working directory - not implemented');
  };

  const handleCreate = async () => {
    const dir = workingDir.trim();
    if (!dir) {
      setError(formatMessage({ id: 'terminalDashboard.cliConfig.errors.workingDirRequired' }));
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onCreateSession({
        tool,
        model,
        launchMode,
        preferredShell,
        workingDir: dir,
      });
      onClose();
    } catch (err) {
      console.error('[CliConfigModal] create session failed:', err);
      setError(formatMessage({ id: 'terminalDashboard.cliConfig.errors.createFailed' }));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[720px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{formatMessage({ id: 'terminalDashboard.cliConfig.title' })}</DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'terminalDashboard.cliConfig.description' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tool */}
            <div className="space-y-2">
              <Label htmlFor="cli-config-tool">
                {formatMessage({ id: 'terminalDashboard.cliConfig.tool' })}
              </Label>
              <Select value={tool} onValueChange={handleToolChange} disabled={isSubmitting}>
                <SelectTrigger id="cli-config-tool">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CLI_TOOLS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="space-y-2">
              <Label htmlFor="cli-config-model">
                {formatMessage({ id: 'terminalDashboard.cliConfig.model' })}
              </Label>
              <Select
                value={model ?? AUTO_MODEL_VALUE}
                onValueChange={(v) => setModel(v === AUTO_MODEL_VALUE ? undefined : v)}
                disabled={isSubmitting}
              >
                <SelectTrigger id="cli-config-model">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO_MODEL_VALUE}>
                    {formatMessage({ id: 'terminalDashboard.cliConfig.modelAuto' })}
                  </SelectItem>
                  {modelOptions.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mode */}
          <div className="space-y-2">
            <Label>{formatMessage({ id: 'terminalDashboard.cliConfig.mode' })}</Label>
            <RadioGroup
              value={launchMode}
              onValueChange={(v) => setLaunchMode(v as LaunchMode)}
              className="flex items-center gap-4"
            >
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="default" />
                {formatMessage({ id: 'terminalDashboard.cliConfig.modeDefault' })}
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <RadioGroupItem value="yolo" />
                {formatMessage({ id: 'terminalDashboard.cliConfig.modeYolo' })}
              </label>
            </RadioGroup>
          </div>

          {/* Shell */}
          <div className="space-y-2">
            <Label htmlFor="cli-config-shell">
              {formatMessage({ id: 'terminalDashboard.cliConfig.shell' })}
            </Label>
            <Select
              value={preferredShell}
              onValueChange={(v) => setPreferredShell(v as ShellKind)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="cli-config-shell">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bash">bash</SelectItem>
                <SelectItem value="pwsh">pwsh</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Working Directory */}
          <div className="space-y-2">
            <Label htmlFor="cli-config-workingDir">
              {formatMessage({ id: 'terminalDashboard.cliConfig.workingDir' })}
            </Label>
            <div className="flex gap-2">
              <Input
                id="cli-config-workingDir"
                value={workingDir}
                onChange={(e) => {
                  setWorkingDir(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={formatMessage({ id: 'terminalDashboard.cliConfig.workingDirPlaceholder' })}
                disabled={isSubmitting}
                className={cn(error && 'border-destructive')}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleBrowse}
                disabled={isSubmitting}
                title={formatMessage({ id: 'terminalDashboard.cliConfig.browse' })}
              >
                <FolderOpen className="w-4 h-4" />
              </Button>
            </div>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            {formatMessage({ id: 'common.actions.cancel' })}
          </Button>
          <Button onClick={handleCreate} disabled={isSubmitting}>
            {formatMessage({ id: 'common.actions.create' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CliConfigModal;

