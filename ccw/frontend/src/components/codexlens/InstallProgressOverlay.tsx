// ========================================
// CodexLens Install Progress Overlay
// ========================================
// Dialog overlay showing 5-stage simulated progress during CodexLens bootstrap installation

import { useState, useEffect, useRef, useCallback } from 'react';
import { useIntl } from 'react-intl';
import {
  Check,
  Download,
  Info,
  Loader2,
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
import { Progress } from '@/components/ui/Progress';
import { Card, CardContent } from '@/components/ui/Card';

// ----------------------------------------
// Types
// ----------------------------------------

interface InstallStage {
  progress: number;
  messageId: string;
}

interface InstallProgressOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onInstall: () => Promise<{ success: boolean }>;
  onSuccess?: () => void;
}

// ----------------------------------------
// Constants
// ----------------------------------------

const INSTALL_STAGES: InstallStage[] = [
  { progress: 10, messageId: 'codexlens.install.stage.creatingVenv' },
  { progress: 30, messageId: 'codexlens.install.stage.installingPip' },
  { progress: 50, messageId: 'codexlens.install.stage.installingPackage' },
  { progress: 70, messageId: 'codexlens.install.stage.settingUpDeps' },
  { progress: 90, messageId: 'codexlens.install.stage.finalizing' },
];

const STAGE_INTERVAL_MS = 1500;

// ----------------------------------------
// Checklist items
// ----------------------------------------

interface ChecklistItem {
  labelId: string;
  descId: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { labelId: 'codexlens.install.pythonVenv', descId: 'codexlens.install.pythonVenvDesc' },
  { labelId: 'codexlens.install.codexlensPackage', descId: 'codexlens.install.codexlensPackageDesc' },
  { labelId: 'codexlens.install.sqliteFts', descId: 'codexlens.install.sqliteFtsDesc' },
];

// ----------------------------------------
// Component
// ----------------------------------------

export function InstallProgressOverlay({
  open,
  onOpenChange,
  onInstall,
  onSuccess,
}: InstallProgressOverlayProps) {
  const { formatMessage } = useIntl();
  const [isInstalling, setIsInstalling] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageText, setStageText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearStageInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setIsInstalling(false);
      setProgress(0);
      setStageText('');
      setIsComplete(false);
      clearStageInterval();
    }
  }, [open, clearStageInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => clearStageInterval();
  }, [clearStageInterval]);

  const handleInstall = async () => {
    setIsInstalling(true);
    setProgress(0);
    setIsComplete(false);

    // Start stage simulation
    let currentStage = 0;
    setStageText(formatMessage({ id: INSTALL_STAGES[0].messageId }));
    setProgress(INSTALL_STAGES[0].progress);
    currentStage = 1;

    intervalRef.current = setInterval(() => {
      if (currentStage < INSTALL_STAGES.length) {
        setStageText(formatMessage({ id: INSTALL_STAGES[currentStage].messageId }));
        setProgress(INSTALL_STAGES[currentStage].progress);
        currentStage++;
      }
    }, STAGE_INTERVAL_MS);

    try {
      const result = await onInstall();
      clearStageInterval();

      if (result.success) {
        setProgress(100);
        setStageText(formatMessage({ id: 'codexlens.install.stage.complete' }));
        setIsComplete(true);

        // Auto-close after showing completion
        setTimeout(() => {
          onOpenChange(false);
          onSuccess?.();
        }, 1200);
      } else {
        setIsInstalling(false);
        setProgress(0);
        setStageText('');
      }
    } catch {
      clearStageInterval();
      setIsInstalling(false);
      setProgress(0);
      setStageText('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={isInstalling ? undefined : onOpenChange}>
      <DialogContent className="max-w-lg" onPointerDownOutside={isInstalling ? (e) => e.preventDefault() : undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-5 h-5 text-primary" />
            {formatMessage({ id: 'codexlens.install.title' })}
          </DialogTitle>
          <DialogDescription>
            {formatMessage({ id: 'codexlens.install.description' })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Install Checklist */}
          <div>
            <h4 className="text-sm font-medium mb-2">
              {formatMessage({ id: 'codexlens.install.checklist' })}
            </h4>
            <ul className="space-y-2">
              {CHECKLIST_ITEMS.map((item) => (
                <li key={item.labelId} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>{formatMessage({ id: item.labelId })}</strong>
                    {' - '}
                    {formatMessage({ id: item.descId })}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Install Location Info */}
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-3 flex items-start gap-2">
              <Info className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div className="text-sm text-muted-foreground">
                <p className="font-medium text-foreground">
                  {formatMessage({ id: 'codexlens.install.location' })}
                </p>
                <p className="mt-1">
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                    {formatMessage({ id: 'codexlens.install.locationPath' })}
                  </code>
                </p>
                <p className="mt-1">
                  {formatMessage({ id: 'codexlens.install.timeEstimate' })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Progress Section - shown during install */}
          {isInstalling && (
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                {isComplete ? (
                  <Check className="w-5 h-5 text-green-500" />
                ) : (
                  <Loader2 className="w-5 h-5 text-primary animate-spin" />
                )}
                <span className="text-sm">{stageText}</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isInstalling}
          >
            {formatMessage({ id: 'common.actions.cancel' })}
          </Button>
          <Button
            onClick={handleInstall}
            disabled={isInstalling}
          >
            {isInstalling ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {formatMessage({ id: 'codexlens.install.installing' })}
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                {formatMessage({ id: 'codexlens.install.installNow' })}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default InstallProgressOverlay;
