// ========================================
// CodexLens Semantic Install Dialog
// ========================================
// Dialog for installing semantic search dependencies with GPU mode selection

import { useState } from 'react';
import { useIntl } from 'react-intl';
import {
  Cpu,
  Zap,
  Monitor,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Label } from '@/components/ui/Label';
import { Card, CardContent } from '@/components/ui/Card';
import { useNotifications } from '@/hooks/useNotifications';
import { useCodexLensMutations } from '@/hooks';
import { cn } from '@/lib/utils';

type GpuMode = 'cpu' | 'cuda' | 'directml';

interface GpuModeOption {
  value: GpuMode;
  label: string;
  description: string;
  icon: React.ReactNode;
  recommended?: boolean;
}

interface SemanticInstallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function SemanticInstallDialog({ open, onOpenChange, onSuccess }: SemanticInstallDialogProps) {
  const { formatMessage } = useIntl();
  const { success, error: showError } = useNotifications();
  const { installSemantic, isInstallingSemantic } = useCodexLensMutations();

  const [selectedMode, setSelectedMode] = useState<GpuMode>('cpu');

  const gpuModes: GpuModeOption[] = [
    {
      value: 'cpu',
      label: formatMessage({ id: 'codexlens.semantic.gpu.cpu' }),
      description: formatMessage({ id: 'codexlens.semantic.gpu.cpuDesc' }),
      icon: <Cpu className="w-5 h-5" />,
    },
    {
      value: 'directml',
      label: formatMessage({ id: 'codexlens.semantic.gpu.directml' }),
      description: formatMessage({ id: 'codexlens.semantic.gpu.directmlDesc' }),
      icon: <Monitor className="w-5 h-5" />,
      recommended: true,
    },
    {
      value: 'cuda',
      label: formatMessage({ id: 'codexlens.semantic.gpu.cuda' }),
      description: formatMessage({ id: 'codexlens.semantic.gpu.cudaDesc' }),
      icon: <Zap className="w-5 h-5" />,
    },
  ];

  const handleInstall = async () => {
    try {
      const result = await installSemantic(selectedMode);
      if (result.success) {
        success(
          formatMessage({ id: 'codexlens.semantic.installSuccess' }),
          result.message || formatMessage({ id: 'codexlens.semantic.installSuccessDesc' }, { mode: selectedMode })
        );
        onSuccess?.();
        onOpenChange(false);
      } else {
        throw new Error(result.message || 'Installation failed');
      }
    } catch (err) {
      showError(
        formatMessage({ id: 'codexlens.semantic.installFailed' }),
        err instanceof Error ? err.message : formatMessage({ id: 'codexlens.semantic.unknownError' })
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            {formatMessage({ id: 'codexlens.semantic.installTitle' })}
          </DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'codexlens.semantic.installDescription' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Info Card */}
          <Card className="bg-muted/50 border-muted">
            <CardContent className="p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-info mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                {formatMessage({ id: 'codexlens.semantic.installInfo' })}
              </div>
            </CardContent>
          </Card>

          {/* GPU Mode Selection */}
          <RadioGroup value={selectedMode} onValueChange={(v) => setSelectedMode(v as GpuMode)}>
            <div className="grid grid-cols-1 gap-3">
              {gpuModes.map((mode) => (
                <Card
                  key={mode.value}
                  className={cn(
                    "cursor-pointer transition-colors hover:bg-accent/50",
                    selectedMode === mode.value && "border-primary bg-accent"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <RadioGroupItem
                        value={mode.value}
                        id={`gpu-mode-${mode.value}`}
                        className="mt-1"
                      />
                      <div className="flex items-start gap-3 flex-1">
                        <div className={cn(
                          "p-2 rounded-lg",
                          selectedMode === mode.value
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-muted-foreground"
                        )}>
                          {mode.icon}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Label
                              htmlFor={`gpu-mode-${mode.value}`}
                              className="font-medium cursor-pointer"
                            >
                              {mode.label}
                            </Label>
                            {mode.recommended && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                {formatMessage({ id: 'codexlens.semantic.recommended' })}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {mode.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </RadioGroup>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isInstallingSemantic}
          >
            {formatMessage({ id: 'common.actions.cancel' })}
          </Button>
          <Button
            onClick={handleInstall}
            disabled={isInstallingSemantic}
          >
            {isInstallingSemantic ? (
              <>
                <Zap className="w-4 h-4 mr-2 animate-pulse" />
                {formatMessage({ id: 'codexlens.semantic.installing' })}
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'codexlens.semantic.install' })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SemanticInstallDialog;
