// ========================================
// Hook Wizard Component
// ========================================
// Multi-step wizard for creating common hook patterns

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import {
  ChevronLeft,
  ChevronRight,
  X,
  Brain,
  Shield,
  Sparkles,
  CheckCircle,
  AlertTriangle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchSkills, type Skill, type SkillsResponse, createHook } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  detect,
  getShell,
  getShellCommand,
  getShellName,
  checkCompatibility,
  getPlatformName,
  DEFAULT_PLATFORM_REQUIREMENTS,
  type Platform,
} from '@/utils/platformUtils';

// ========== Types ==========

/**
 * Supported wizard types
 */
export type WizardType = 'memory-update' | 'danger-protection' | 'skill-context';

/**
 * Wizard step number
 */
type WizardStep = 1 | 2 | 3;

/**
 * Component props
 */
export interface HookWizardProps {
  /** Type of wizard to launch */
  wizardType: WizardType;
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog is closed */
  onClose: () => void;
}

/**
 * Memory update wizard configuration
 */
interface MemoryUpdateConfig {
  claudePath: string;
  updateFrequency: 'session-end' | 'hourly' | 'daily';
  sections: string[];
}

/**
 * Danger protection wizard configuration
 */
interface DangerProtectionConfig {
  keywords: string;
  confirmationMessage: string;
  allowBypass: boolean;
}

/**
 * Skill context wizard configuration
 */
interface SkillContextConfig {
  keywordSkillPairs: Array<{ keyword: string; skill: string }>;
  priority: 'high' | 'medium' | 'low';
}

// ========== Wizard Definitions ==========

/**
 * Wizard metadata for each type
 */
const WIZARD_METADATA = {
  'memory-update': {
    title: 'cliHooks.wizards.memoryUpdate.title',
    description: 'cliHooks.wizards.memoryUpdate.description',
    icon: Brain,
    trigger: 'Stop' as const,
    platformRequirements: DEFAULT_PLATFORM_REQUIREMENTS['memory-update'],
  },
  'danger-protection': {
    title: 'cliHooks.wizards.dangerProtection.title',
    description: 'cliHooks.wizards.dangerProtection.description',
    icon: Shield,
    trigger: 'UserPromptSubmit' as const,
    platformRequirements: DEFAULT_PLATFORM_REQUIREMENTS['danger-protection'],
  },
  'skill-context': {
    title: 'cliHooks.wizards.skillContext.title',
    description: 'cliHooks.wizards.skillContext.description',
    icon: Sparkles,
    trigger: 'UserPromptSubmit' as const,
    platformRequirements: DEFAULT_PLATFORM_REQUIREMENTS['skill-context'],
  },
} as const;

// ========== Helper Functions ==========

/**
 * Get wizard icon component
 */
function getWizardIcon(type: WizardType) {
  return WIZARD_METADATA[type].icon;
}

// ========== Main Component ==========

export function HookWizard({
  wizardType,
  open,
  onClose,
}: HookWizardProps) {
  const { formatMessage } = useIntl();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [detectedPlatform, setDetectedPlatform] = useState<Platform>('linux');

  // Fetch available skills for skill-context wizard
  const { data: skillsData, isLoading: skillsLoading } = useQuery<SkillsResponse>({
    queryKey: ['skills'],
    queryFn: () => fetchSkills(),
    enabled: open && wizardType === 'skill-context',
  });

  // Mutation for creating hook
  const createMutation = useMutation({
    mutationFn: createHook,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hooks'] });
      onClose();
      setCurrentStep(1);
    },
  });

  // Detect platform on mount
  useEffect(() => {
    if (open) {
      setDetectedPlatform(detect());
    }
  }, [open]);

  // Wizard configuration state
  const [memoryConfig, setMemoryConfig] = useState<MemoryUpdateConfig>({
    claudePath: '.claude/CLAUDE.md',
    updateFrequency: 'session-end',
    sections: ['all'],
  });

  const [dangerConfig, setDangerConfig] = useState<DangerProtectionConfig>({
    keywords: 'delete\nrm\nformat\ndrop\ntruncate\nshutdown',
    confirmationMessage: 'Are you sure you want to perform this action: {action}?',
    allowBypass: true,
  });

  const [skillConfig, setSkillConfig] = useState<SkillContextConfig>({
    keywordSkillPairs: [{ keyword: '', skill: '' }],
    priority: 'medium',
  });

  // Check platform compatibility
  const wizardMetadata = WIZARD_METADATA[wizardType];
  const compatibilityCheck = checkCompatibility(
    wizardMetadata.platformRequirements,
    detectedPlatform
  );

  // Handlers
  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep((prev) => (prev + 1) as WizardStep);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as WizardStep);
    }
  };

  const handleClose = () => {
    setCurrentStep(1);
    onClose();
  };

  const handleComplete = async () => {
    let hookConfig: {
      name: string;
      description: string;
      trigger: string;
      matcher?: string;
      command: string;
    };

    const wizardName = formatMessage({ id: WIZARD_METADATA[wizardType].title });

    switch (wizardType) {
      case 'memory-update':
        hookConfig = {
          name: `memory-update-${Date.now()}`,
          description: `${wizardName}: Update ${memoryConfig.claudePath} on ${memoryConfig.updateFrequency}`,
          trigger: wizardMetadata.trigger,
          command: buildMemoryUpdateCommand(memoryConfig, detectedPlatform),
        };
        break;

      case 'danger-protection':
        hookConfig = {
          name: `danger-protection-${Date.now()}`,
          description: `${wizardName}: Confirm dangerous operations`,
          trigger: wizardMetadata.trigger,
          matcher: buildDangerMatcher(dangerConfig),
          command: buildDangerProtectionCommand(dangerConfig, detectedPlatform),
        };
        break;

      case 'skill-context':
        hookConfig = {
          name: `skill-context-${Date.now()}`,
          description: `${wizardName}: Load SKILL based on keywords`,
          trigger: wizardMetadata.trigger,
          matcher: buildSkillMatcher(skillConfig),
          command: buildSkillContextCommand(skillConfig, detectedPlatform),
        };
        break;

      default:
        return;
    }

    await createMutation.mutateAsync(hookConfig);
  };

  // Step renderers
  const renderStep1 = () => {
    const WizardIcon = getWizardIcon(wizardType);

    return (
      <div className="space-y-4">
        {/* Introduction */}
        <div className="flex items-center gap-3 pb-4 border-b">
          <div className="p-3 rounded-lg bg-primary/10">
            <WizardIcon className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">
              {formatMessage({ id: WIZARD_METADATA[wizardType].title })}
            </h3>
            <p className="text-sm text-muted-foreground">
              {formatMessage({ id: WIZARD_METADATA[wizardType].description })}
            </p>
          </div>
        </div>

        {/* Platform Detection */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <CheckCircle className={cn(
              'w-5 h-5',
              compatibilityCheck.compatible ? 'text-green-500' : 'text-destructive'
            )} />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {formatMessage({ id: 'cliHooks.wizards.platform.detected' })}
              </p>
              <p className="text-xs text-muted-foreground">
                {getPlatformName(detectedPlatform)} ({getShellName(getShell(detectedPlatform))})
              </p>
            </div>
            <Badge variant={compatibilityCheck.compatible ? 'default' : 'destructive'}>
              {compatibilityCheck.compatible
                ? formatMessage({ id: 'cliHooks.wizards.platform.compatible' })
                : formatMessage({ id: 'cliHooks.wizards.platform.incompatible' })
              }
            </Badge>
          </div>

          {/* Compatibility Issues */}
          {!compatibilityCheck.compatible && compatibilityCheck.issues.length > 0 && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">
                  {formatMessage({ id: 'cliHooks.wizards.platform.compatibilityError' })}
                </p>
                <ul className="mt-1 space-y-1">
                  {compatibilityCheck.issues.map((issue, i) => (
                    <li key={i} className="text-xs text-destructive/80">
                      {issue}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Compatibility Warnings */}
          {compatibilityCheck.warnings.length > 0 && (
            <div className="mt-3 flex items-start gap-2 p-3 bg-yellow-500/10 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-yellow-600">
                  {formatMessage({ id: 'cliHooks.wizards.platform.compatibilityWarning' })}
                </p>
                <ul className="mt-1 space-y-1">
                  {compatibilityCheck.warnings.map((warning, i) => (
                    <li key={i} className="text-xs text-yellow-600/80">
                      {warning}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </Card>

        {/* Trigger Event */}
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-2">
            {formatMessage({ id: 'cliHooks.wizards.steps.triggerEvent' })}
          </p>
          <Badge variant="secondary">
            {formatMessage({ id: `cliHooks.trigger.${wizardMetadata.trigger}` })}
          </Badge>
        </Card>
      </div>
    );
  };

  const renderStep2 = () => {
    switch (wizardType) {
      case 'memory-update':
        return renderMemoryUpdateConfig();
      case 'danger-protection':
        return renderDangerProtectionConfig();
      case 'skill-context':
        return renderSkillContextConfig();
      default:
        return null;
    }
  };

  const renderStep3 = () => {
    return (
      <div className="space-y-4">
        <div className="text-center pb-4 border-b">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-foreground">
            {formatMessage({ id: 'cliHooks.wizards.steps.review.title' })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {formatMessage({ id: 'cliHooks.wizards.steps.review.description' })}
          </p>
        </div>

        {/* Summary */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {formatMessage({ id: 'cliHooks.wizards.steps.review.hookType' })}
            </span>
            <span className="text-sm font-medium text-foreground">
              {formatMessage({ id: WIZARD_METADATA[wizardType].title })}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {formatMessage({ id: 'cliHooks.wizards.steps.review.trigger' })}
            </span>
            <Badge variant="secondary" className="text-xs">
              {formatMessage({ id: `cliHooks.trigger.${wizardMetadata.trigger}` })}
            </Badge>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {formatMessage({ id: 'cliHooks.wizards.steps.review.platform' })}
            </span>
            <span className="text-sm text-foreground">
              {getPlatformName(detectedPlatform)}
            </span>
          </div>

          {/* Configuration Summary */}
          {renderConfigSummary()}
        </Card>

        {/* Command Preview */}
        <Card className="p-4">
          <p className="text-xs text-muted-foreground mb-2">
            {formatMessage({ id: 'cliHooks.wizards.steps.review.commandPreview' })}
          </p>
          <pre className="text-xs font-mono bg-muted p-3 rounded-lg overflow-x-auto">
            {getPreviewCommand()}
          </pre>
        </Card>
      </div>
    );
  };

  // Configuration renderers
  const renderMemoryUpdateConfig = () => (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground">
          {formatMessage({ id: 'cliHooks.wizards.memoryUpdate.claudePath' })}
        </label>
        <Input
          value={memoryConfig.claudePath}
          onChange={(e) => setMemoryConfig({ ...memoryConfig, claudePath: e.target.value })}
          placeholder=".claude/CLAUDE.md"
          className="mt-1 font-mono"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground">
          {formatMessage({ id: 'cliHooks.wizards.memoryUpdate.updateFrequency' })}
        </label>
        <Select
          value={memoryConfig.updateFrequency}
          onValueChange={(value: any) => setMemoryConfig({ ...memoryConfig, updateFrequency: value })}
        >
          <SelectTrigger className="mt-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="session-end">
              {formatMessage({ id: 'cliHooks.wizards.memoryUpdate.frequency.sessionEnd' })}
            </SelectItem>
            <SelectItem value="hourly">
              {formatMessage({ id: 'cliHooks.wizards.memoryUpdate.frequency.hourly' })}
            </SelectItem>
            <SelectItem value="daily">
              {formatMessage({ id: 'cliHooks.wizards.memoryUpdate.frequency.daily' })}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const renderDangerProtectionConfig = () => (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-foreground">
          {formatMessage({ id: 'cliHooks.wizards.dangerProtection.keywords' })}
        </label>
        <p className="text-xs text-muted-foreground mt-1">
          {formatMessage({ id: 'cliHooks.wizards.dangerProtection.keywordsHelp' })}
        </p>
        <Textarea
          value={dangerConfig.keywords}
          onChange={(e) => setDangerConfig({ ...dangerConfig, keywords: e.target.value })}
          placeholder="delete\nrm\nformat"
          className="mt-1 font-mono text-sm"
          rows={5}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground">
          {formatMessage({ id: 'cliHooks.wizards.dangerProtection.confirmationMessage' })}
        </label>
        <Input
          value={dangerConfig.confirmationMessage}
          onChange={(e) => setDangerConfig({ ...dangerConfig, confirmationMessage: e.target.value })}
          placeholder="Are you sure you want to {action}?"
          className="mt-1"
        />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="allow-bypass"
          checked={dangerConfig.allowBypass}
          onChange={(e) => setDangerConfig({ ...dangerConfig, allowBypass: e.target.checked })}
          className="rounded"
        />
        <label htmlFor="allow-bypass" className="text-sm text-foreground">
          {formatMessage({ id: 'cliHooks.wizards.dangerProtection.allowBypass' })}
        </label>
      </div>
    </div>
  );

  const renderSkillContextConfig = () => {
    const skills: Skill[] = skillsData?.skills ?? [];

    const addPair = () => {
      setSkillConfig({
        ...skillConfig,
        keywordSkillPairs: [...skillConfig.keywordSkillPairs, { keyword: '', skill: '' }],
      });
    };

    const removePair = (index: number) => {
      setSkillConfig({
        ...skillConfig,
        keywordSkillPairs: skillConfig.keywordSkillPairs.filter((_, i) => i !== index),
      });
    };

    const updatePair = (index: number, field: 'keyword' | 'skill', value: string) => {
      const newPairs = [...skillConfig.keywordSkillPairs];
      newPairs[index][field] = value;
      setSkillConfig({ ...skillConfig, keywordSkillPairs: newPairs });
    };

    return (
      <div className="space-y-4">
        {skillsLoading ? (
          <p className="text-sm text-muted-foreground">
            {formatMessage({ id: 'cliHooks.wizards.skillContext.loadingSkills' })}
          </p>
        ) : (
          <div className="space-y-3">
            {skillConfig.keywordSkillPairs.map((pair, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={pair.keyword}
                  onChange={(e) => updatePair(index, 'keyword', e.target.value)}
                  placeholder={formatMessage({ id: 'cliHooks.wizards.skillContext.keywordPlaceholder' })}
                  className="flex-1"
                />
                <Select value={pair.skill} onValueChange={(value) => updatePair(index, 'skill', value)}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder={formatMessage({ id: 'cliHooks.wizards.skillContext.selectSkill' })} />
                  </SelectTrigger>
                  <SelectContent>
                    {skills.map((skill) => (
                      <SelectItem key={skill.name} value={skill.name}>
                        {skill.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {skillConfig.keywordSkillPairs.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removePair(index)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addPair} className="w-full">
              <Plus className="w-4 h-4 mr-1" />
              {formatMessage({ id: 'cliHooks.wizards.skillContext.addPair' })}
            </Button>
          </div>
        )}

        <div>
          <label className="text-sm font-medium text-foreground">
            {formatMessage({ id: 'cliHooks.wizards.skillContext.priority' })}
          </label>
          <Select
            value={skillConfig.priority}
            onValueChange={(value: any) => setSkillConfig({ ...skillConfig, priority: value })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">
                {formatMessage({ id: 'cliHooks.wizards.skillContext.priorityHigh' })}
              </SelectItem>
              <SelectItem value="medium">
                {formatMessage({ id: 'cliHooks.wizards.skillContext.priorityMedium' })}
              </SelectItem>
              <SelectItem value="low">
                {formatMessage({ id: 'cliHooks.wizards.skillContext.priorityLow' })}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    );
  };

  // Config summary for review step
  const renderConfigSummary = () => {
    switch (wizardType) {
      case 'memory-update':
        return (
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {formatMessage({ id: 'cliHooks.wizards.memoryUpdate.claudePath' })}
              </span>
              <span className="font-mono">{memoryConfig.claudePath}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {formatMessage({ id: 'cliHooks.wizards.memoryUpdate.updateFrequency' })}
              </span>
              <span>
                {formatMessage({ id: `cliHooks.wizards.memoryUpdate.frequency.${memoryConfig.updateFrequency}` })}
              </span>
            </div>
          </div>
        );

      case 'danger-protection':
        return (
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">
                {formatMessage({ id: 'cliHooks.wizards.dangerProtection.keywords' })}:
              </span>
              <div className="mt-1 flex flex-wrap gap-1">
                {dangerConfig.keywords.split('\n').filter(Boolean).map((kw, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {kw.trim()}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {formatMessage({ id: 'cliHooks.wizards.dangerProtection.allowBypass' })}
              </span>
              <span>{dangerConfig.allowBypass ? 'Yes' : 'No'}</span>
            </div>
          </div>
        );

      case 'skill-context':
        return (
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-muted-foreground">
                {formatMessage({ id: 'cliHooks.wizards.skillContext.keywordMappings' })}:
              </span>
              <div className="mt-1 space-y-1">
                {skillConfig.keywordSkillPairs
                  .filter((p) => p.keyword && p.skill)
                  .map((pair, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline">{pair.keyword}</Badge>
                      <span className="text-muted-foreground">{'->'}</span>
                      <Badge variant="secondary">{pair.skill}</Badge>
                    </div>
                  ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {formatMessage({ id: 'cliHooks.wizards.skillContext.priority' })}
              </span>
              <span>
                {formatMessage({ id: `cliHooks.wizards.skillContext.priority${skillConfig.priority.charAt(0).toUpperCase()}${skillConfig.priority.slice(1)}` })}
              </span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Get command preview for review step
  const getPreviewCommand = (): string => {
    switch (wizardType) {
      case 'memory-update':
        return buildMemoryUpdateCommand(memoryConfig, detectedPlatform);
      case 'danger-protection':
        return buildDangerProtectionCommand(dangerConfig, detectedPlatform);
      case 'skill-context':
        return buildSkillContextCommand(skillConfig, detectedPlatform);
      default:
        return '';
    }
  };

  // Navigation buttons
  const renderNavigation = () => (
    <DialogFooter className="gap-2">
      {currentStep > 1 && (
        <Button variant="outline" onClick={handlePrevious} disabled={createMutation.isPending}>
          <ChevronLeft className="w-4 h-4 mr-1" />
          {formatMessage({ id: 'cliHooks.wizards.navigation.previous' })}
        </Button>
      )}
      {currentStep < 3 ? (
        <Button onClick={handleNext} disabled={!compatibilityCheck.compatible}>
          {formatMessage({ id: 'cliHooks.wizards.navigation.next' })}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      ) : (
        <Button onClick={handleComplete} disabled={createMutation.isPending}>
          {createMutation.isPending
            ? formatMessage({ id: 'cliHooks.wizards.navigation.creating' })
            : formatMessage({ id: 'cliHooks.wizards.navigation.create' })
          }
        </Button>
      )}
      <Button variant="ghost" onClick={handleClose} disabled={createMutation.isPending}>
        <X className="w-4 h-4" />
      </Button>
    </DialogFooter>
  );

  // Step indicator
  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 pb-4">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium',
              currentStep === step
                ? 'bg-primary text-primary-foreground'
                : currentStep > step
                ? 'bg-green-500 text-white'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {currentStep > step ? <CheckCircle className="w-4 h-4" /> : step}
          </div>
          {step < 3 && (
            <div
              className={cn(
                'w-8 h-0.5 mx-1',
                currentStep > step ? 'bg-green-500' : 'bg-muted'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {formatMessage({ id: 'cliHooks.wizards.title' })}
          </DialogTitle>
        </DialogHeader>

        {renderStepIndicator()}

        <div className="min-h-[300px]">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        {renderNavigation()}
      </DialogContent>
    </Dialog>
  );
}

export default HookWizard;

// ========== Command Builders ==========

function buildMemoryUpdateCommand(config: MemoryUpdateConfig, platform: Platform): string {
  const shellCmd = getShellCommand(getShell(platform));
  const command = `echo "Updating ${config.claudePath} at ${config.updateFrequency}"`;
  return JSON.stringify([...shellCmd, command]);
}

function buildDangerMatcher(config: DangerProtectionConfig): string {
  const keywords = config.keywords.split('\n').filter(Boolean).join('|');
  return `(${keywords})`;
}

function buildDangerProtectionCommand(config: DangerProtectionConfig, platform: Platform): string {
  const shellCmd = getShellCommand(getShell(platform));
  const command = `echo "Checking for dangerous operations: ${config.keywords.split('\n').filter(Boolean).join(', ')}"`;
  return JSON.stringify([...shellCmd, command]);
}

function buildSkillMatcher(config: SkillContextConfig): string {
  const keywords = config.keywordSkillPairs
    .filter((p) => p.keyword)
    .map((p) => p.keyword)
    .join('|');
  return `(${keywords})`;
}

function buildSkillContextCommand(config: SkillContextConfig, platform: Platform): string {
  const pairs = config.keywordSkillPairs.filter((p) => p.keyword && p.skill);
  const command = `echo "Loading SKILL based on keywords: ${pairs.map((p) => p.keyword).join(', ')}"`;
  return JSON.stringify([...getShellCommand(getShell(platform)), command]);
}
