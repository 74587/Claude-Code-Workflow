// ========================================
// CodexLens Advanced Tab
// ========================================
// Advanced settings including .env editor and ignore patterns

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Save, RefreshCw, AlertTriangle, FileCode, AlertCircle, Filter } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/Label';
import { Badge } from '@/components/ui/Badge';
import {
  useCodexLensEnv,
  useCodexLensIgnorePatterns,
  useUpdateCodexLensEnv,
  useUpdateIgnorePatterns,
} from '@/hooks';
import { useNotifications } from '@/hooks';
import { cn } from '@/lib/utils';
import { CcwToolsCard } from './CcwToolsCard';

interface AdvancedTabProps {
  enabled?: boolean;
}

interface FormErrors {
  env?: string;
  ignorePatterns?: string;
  extensionFilters?: string;
}

const FILTER_ENTRY_PATTERN = /^[-\w.*\\/]+$/;

function parseListEntries(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function normalizeListEntries(entries: string[]): string {
  return entries
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join('\n');
}

function normalizeListText(text: string): string {
  return normalizeListEntries(parseListEntries(text));
}

export function AdvancedTab({ enabled = true }: AdvancedTabProps) {
  const { formatMessage } = useIntl();
  const { success, error: showError } = useNotifications();

  const {
    raw,
    env,
    settings,
    isLoading: isLoadingEnv,
    error: envError,
    refetch,
  } = useCodexLensEnv({ enabled });

  const {
    patterns,
    extensionFilters,
    defaults,
    isLoading: isLoadingPatterns,
    error: patternsError,
    refetch: refetchPatterns,
  } = useCodexLensIgnorePatterns({ enabled });

  const { updateEnv, isUpdating } = useUpdateCodexLensEnv();
  const { updatePatterns, isUpdating: isUpdatingPatterns } = useUpdateIgnorePatterns();

  // Form state
  const [envInput, setEnvInput] = useState('');
  const [ignorePatternsInput, setIgnorePatternsInput] = useState('');
  const [extensionFiltersInput, setExtensionFiltersInput] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [hasFilterChanges, setHasFilterChanges] = useState(false);
  const [showWarning, setShowWarning] = useState(false);

  const currentIgnorePatterns = patterns ?? [];
  const currentExtensionFilters = extensionFilters ?? [];
  const defaultIgnorePatterns = defaults?.patterns ?? [];
  const defaultExtensionFilters = defaults?.extensionFilters ?? [];

  // Initialize form from env - handles both undefined (loading) and empty string (empty file)
  // The hook returns raw directly, so we check if it's been set (not undefined means data loaded)
  useEffect(() => {
    // Initialize when data is loaded (raw may be empty string but not undefined during loading)
    // Note: During initial load, raw is undefined. After load completes, raw is set (even if empty string)
    if (!isLoadingEnv) {
      setEnvInput(raw ?? ''); // Use empty string if raw is undefined/null
      setErrors({});
      setHasChanges(false);
      setShowWarning(false);
    }
  }, [raw, isLoadingEnv]);

  useEffect(() => {
    if (!isLoadingPatterns) {
      const nextIgnorePatterns = patterns ?? [];
      const nextExtensionFilters = extensionFilters ?? [];
      setIgnorePatternsInput(nextIgnorePatterns.join('\n'));
      setExtensionFiltersInput(nextExtensionFilters.join('\n'));
      setErrors((prev) => ({
        ...prev,
        ignorePatterns: undefined,
        extensionFilters: undefined,
      }));
      setHasFilterChanges(false);
    }
  }, [extensionFilters, isLoadingPatterns, patterns]);

  const updateFilterChangeState = (nextIgnorePatternsInput: string, nextExtensionFiltersInput: string) => {
    const normalizedCurrentIgnorePatterns = normalizeListEntries(currentIgnorePatterns);
    const normalizedCurrentExtensionFilters = normalizeListEntries(currentExtensionFilters);

    setHasFilterChanges(
      normalizeListText(nextIgnorePatternsInput) !== normalizedCurrentIgnorePatterns
      || normalizeListText(nextExtensionFiltersInput) !== normalizedCurrentExtensionFilters
    );
  };

  const handleEnvChange = (value: string) => {
    setEnvInput(value);
    // Check if there are changes - compare with raw value (handle undefined as empty)
    const currentRaw = raw ?? '';
    setHasChanges(value !== currentRaw);
    setShowWarning(value !== currentRaw);
    if (errors.env) {
      setErrors((prev) => ({ ...prev, env: undefined }));
    }
  };

  const handleIgnorePatternsChange = (value: string) => {
    setIgnorePatternsInput(value);
    updateFilterChangeState(value, extensionFiltersInput);
    if (errors.ignorePatterns) {
      setErrors((prev) => ({ ...prev, ignorePatterns: undefined }));
    }
  };

  const handleExtensionFiltersChange = (value: string) => {
    setExtensionFiltersInput(value);
    updateFilterChangeState(ignorePatternsInput, value);
    if (errors.extensionFilters) {
      setErrors((prev) => ({ ...prev, extensionFilters: undefined }));
    }
  };

  const parseEnvVariables = (text: string): Record<string, string> => {
    const envObj: Record<string, string> = {};
    const lines = text.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
        const [key, ...valParts] = trimmed.split('=');
        const val = valParts.join('=');
        if (key) {
          envObj[key.trim()] = val.trim();
        }
      }
    }
    return envObj;
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    const parsed = parseEnvVariables(envInput);

    // Check for invalid variable names
    const invalidKeys = Object.keys(parsed).filter(
      (key) => !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)
    );

    if (invalidKeys.length > 0) {
      newErrors.env = formatMessage(
        { id: 'codexlens.advanced.validation.invalidKeys' },
        { keys: invalidKeys.join(', ') }
      );
    }

    setErrors((prev) => ({ ...prev, env: newErrors.env }));
    return Object.keys(newErrors).length === 0;
  };

  const validateFilterForm = (): boolean => {
    const nextErrors: Pick<FormErrors, 'ignorePatterns' | 'extensionFilters'> = {};
    const parsedIgnorePatterns = parseListEntries(ignorePatternsInput);
    const parsedExtensionFilters = parseListEntries(extensionFiltersInput);

    const invalidIgnorePatterns = parsedIgnorePatterns.filter(
      (entry) => !FILTER_ENTRY_PATTERN.test(entry)
    );
    if (invalidIgnorePatterns.length > 0) {
      nextErrors.ignorePatterns = formatMessage(
        {
          id: 'codexlens.advanced.validation.invalidIgnorePatterns',
          defaultMessage: 'Invalid ignore patterns: {values}',
        },
        { values: invalidIgnorePatterns.join(', ') }
      );
    }

    const invalidExtensionFilters = parsedExtensionFilters.filter(
      (entry) => !FILTER_ENTRY_PATTERN.test(entry)
    );
    if (invalidExtensionFilters.length > 0) {
      nextErrors.extensionFilters = formatMessage(
        {
          id: 'codexlens.advanced.validation.invalidExtensionFilters',
          defaultMessage: 'Invalid file filters: {values}',
        },
        { values: invalidExtensionFilters.join(', ') }
      );
    }

    setErrors((prev) => ({
      ...prev,
      ignorePatterns: nextErrors.ignorePatterns,
      extensionFilters: nextErrors.extensionFilters,
    }));

    return Object.values(nextErrors).every((value) => !value);
  };

  const handleSave = async () => {
    if (!validateForm()) {
      return;
    }

    try {
      const parsed = parseEnvVariables(envInput);
      const result = await updateEnv({ env: parsed });

      if (result.success) {
        success(
          formatMessage({ id: 'codexlens.advanced.saveSuccess' }),
          result.message || formatMessage({ id: 'codexlens.advanced.envUpdated' })
        );
        refetch();
        setShowWarning(false);
      } else {
        showError(
          formatMessage({ id: 'codexlens.advanced.saveFailed' }),
          result.message || formatMessage({ id: 'codexlens.advanced.saveError' })
        );
      }
    } catch (err) {
      showError(
        formatMessage({ id: 'codexlens.advanced.saveFailed' }),
        err instanceof Error ? err.message : formatMessage({ id: 'codexlens.advanced.unknownError' })
      );
    }
  };

  const handleReset = () => {
    // Reset to current raw value (handle undefined as empty)
    setEnvInput(raw ?? '');
    setErrors((prev) => ({ ...prev, env: undefined }));
    setHasChanges(false);
    setShowWarning(false);
  };

  const handleSaveFilters = async () => {
    if (!validateFilterForm()) {
      return;
    }

    const parsedIgnorePatterns = parseListEntries(ignorePatternsInput);
    const parsedExtensionFilters = parseListEntries(extensionFiltersInput);

    try {
      const result = await updatePatterns({
        patterns: parsedIgnorePatterns,
        extensionFilters: parsedExtensionFilters,
      });

      if (result.success) {
        setIgnorePatternsInput((result.patterns ?? parsedIgnorePatterns).join('\n'));
        setExtensionFiltersInput((result.extensionFilters ?? parsedExtensionFilters).join('\n'));
        setHasFilterChanges(false);
        setErrors((prev) => ({
          ...prev,
          ignorePatterns: undefined,
          extensionFilters: undefined,
        }));
        await refetchPatterns();
      }
    } catch {
      // Hook-level mutation already reports the error.
    }
  };

  const handleResetFilters = () => {
    setIgnorePatternsInput(currentIgnorePatterns.join('\n'));
    setExtensionFiltersInput(currentExtensionFilters.join('\n'));
    setErrors((prev) => ({
      ...prev,
      ignorePatterns: undefined,
      extensionFilters: undefined,
    }));
    setHasFilterChanges(false);
  };

  const handleRestoreDefaultFilters = () => {
    const defaultIgnoreText = defaultIgnorePatterns.join('\n');
    const defaultExtensionText = defaultExtensionFilters.join('\n');

    setIgnorePatternsInput(defaultIgnoreText);
    setExtensionFiltersInput(defaultExtensionText);
    setErrors((prev) => ({
      ...prev,
      ignorePatterns: undefined,
      extensionFilters: undefined,
    }));
    updateFilterChangeState(defaultIgnoreText, defaultExtensionText);
  };

  const isLoading = isLoadingEnv;
  const isLoadingFilters = isLoadingPatterns;

  // Get current env variables as array for display
  const currentEnvVars = env
    ? Object.entries(env).map(([key, value]) => ({ key, value }))
    : [];

  // Get settings variables
  const settingsVars = settings
    ? Object.entries(settings).map(([key, value]) => ({ key, value }))
    : [];

  return (
    <div className="space-y-6">
      {/* Error Card */}
      {envError && (
        <Card className="p-4 bg-destructive/10 border-destructive/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-medium text-destructive-foreground">
                {formatMessage({ id: 'codexlens.advanced.loadError' })}
              </h4>
              <p className="text-xs text-destructive-foreground/80 mt-1">
                {envError.message || formatMessage({ id: 'codexlens.advanced.loadErrorDesc' })}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                className="mt-2"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {formatMessage({ id: 'common.actions.retry' })}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Sensitivity Warning Card */}
      {showWarning && (
        <Card className="p-4 bg-warning/10 border-warning/20">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-medium text-warning-foreground">
                {formatMessage({ id: 'codexlens.advanced.warningTitle' })}
              </h4>
              <p className="text-xs text-warning-foreground/80 mt-1">
                {formatMessage({ id: 'codexlens.advanced.warningMessage' })}
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Current Variables Summary */}
      {(currentEnvVars.length > 0 || settingsVars.length > 0) && (
        <Card className="p-4 bg-muted/30">
          <h4 className="text-sm font-medium text-foreground mb-3">
            {formatMessage({ id: 'codexlens.advanced.currentVars' })}
          </h4>
          <div className="space-y-3">
            {settingsVars.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  {formatMessage({ id: 'codexlens.advanced.settingsVars' })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {settingsVars.map(({ key }) => (
                    <Badge key={key} variant="outline" className="font-mono text-xs">
                      {key}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {currentEnvVars.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  {formatMessage({ id: 'codexlens.advanced.customVars' })}
                </p>
                <div className="flex flex-wrap gap-2">
                  {currentEnvVars.map(({ key }) => (
                    <Badge key={key} variant="secondary" className="font-mono text-xs">
                      {key}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* CCW Tools Card */}
      <CcwToolsCard />

      {/* Index Filters */}
      <Card className="p-6">
        <div className="flex flex-col gap-3 mb-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">
              {formatMessage({
                id: 'codexlens.advanced.indexFilters',
                defaultMessage: 'Index Filters',
              })}
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {formatMessage(
                {
                  id: 'codexlens.advanced.ignorePatternCount',
                  defaultMessage: 'Directory filters: {count}',
                },
                { count: currentIgnorePatterns.length }
              )}
            </Badge>
            <Badge variant="outline" className="text-xs">
              {formatMessage(
                {
                  id: 'codexlens.advanced.extensionFilterCount',
                  defaultMessage: 'File filters: {count}',
                },
                { count: currentExtensionFilters.length }
              )}
            </Badge>
          </div>
        </div>

        <div className="space-y-4">
          {patternsError && (
            <div className="rounded-md border border-destructive/20 bg-destructive/5 p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 text-destructive" />
                <div>
                  <p className="text-sm font-medium text-destructive">
                    {formatMessage({
                      id: 'codexlens.advanced.filtersLoadError',
                      defaultMessage: 'Unable to load current filter settings',
                    })}
                  </p>
                  <p className="text-xs text-destructive/80 mt-1">{patternsError.message}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ignore-patterns-input">
                {formatMessage({
                  id: 'codexlens.advanced.ignorePatterns',
                  defaultMessage: 'Ignored directories / paths',
                })}
              </Label>
              <Textarea
                id="ignore-patterns-input"
                value={ignorePatternsInput}
                onChange={(event) => handleIgnorePatternsChange(event.target.value)}
                placeholder={formatMessage({
                  id: 'codexlens.advanced.ignorePatternsPlaceholder',
                  defaultMessage: 'dist\nfrontend/dist\ncoverage',
                })}
                className={cn(
                  'min-h-[220px] font-mono text-sm',
                  errors.ignorePatterns && 'border-destructive focus-visible:ring-destructive'
                )}
                disabled={isLoadingFilters || isUpdatingPatterns}
              />
              {errors.ignorePatterns && (
                <p className="text-sm text-destructive">{errors.ignorePatterns}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {formatMessage({
                  id: 'codexlens.advanced.ignorePatternsHint',
                  defaultMessage: 'One entry per line. Supports exact names, relative paths, and glob patterns.',
                })}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="extension-filters-input">
                {formatMessage({
                  id: 'codexlens.advanced.extensionFilters',
                  defaultMessage: 'Skipped files / globs',
                })}
              </Label>
              <Textarea
                id="extension-filters-input"
                value={extensionFiltersInput}
                onChange={(event) => handleExtensionFiltersChange(event.target.value)}
                placeholder={formatMessage({
                  id: 'codexlens.advanced.extensionFiltersPlaceholder',
                  defaultMessage: '*.min.js\n*.map\npackage-lock.json',
                })}
                className={cn(
                  'min-h-[220px] font-mono text-sm',
                  errors.extensionFilters && 'border-destructive focus-visible:ring-destructive'
                )}
                disabled={isLoadingFilters || isUpdatingPatterns}
              />
              {errors.extensionFilters && (
                <p className="text-sm text-destructive">{errors.extensionFilters}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {formatMessage({
                  id: 'codexlens.advanced.extensionFiltersHint',
                  defaultMessage: 'Use this for generated or low-value files that should stay out of the index.',
                })}
              </p>
            </div>
          </div>

          <div className="grid gap-3 rounded-md border border-border/60 bg-muted/30 p-3 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-foreground">
                {formatMessage({
                  id: 'codexlens.advanced.defaultIgnorePatterns',
                  defaultMessage: 'Default directory filters',
                })}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {defaultIgnorePatterns.slice(0, 6).map((pattern) => (
                  <Badge key={pattern} variant="secondary" className="font-mono text-xs">
                    {pattern}
                  </Badge>
                ))}
                {defaultIgnorePatterns.length > 6 && (
                  <Badge variant="outline" className="text-xs">
                    +{defaultIgnorePatterns.length - 6}
                  </Badge>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-foreground">
                {formatMessage({
                  id: 'codexlens.advanced.defaultExtensionFilters',
                  defaultMessage: 'Default file filters',
                })}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {defaultExtensionFilters.slice(0, 6).map((pattern) => (
                  <Badge key={pattern} variant="secondary" className="font-mono text-xs">
                    {pattern}
                  </Badge>
                ))}
                {defaultExtensionFilters.length > 6 && (
                  <Badge variant="outline" className="text-xs">
                    +{defaultExtensionFilters.length - 6}
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={handleSaveFilters}
              disabled={isLoadingFilters || isUpdatingPatterns || !hasFilterChanges}
            >
              <Save className={cn('w-4 h-4 mr-2', isUpdatingPatterns && 'animate-spin')} />
              {isUpdatingPatterns
                ? formatMessage({ id: 'codexlens.advanced.saving', defaultMessage: 'Saving...' })
                : formatMessage({
                  id: 'codexlens.advanced.saveFilters',
                  defaultMessage: 'Save filters',
                })
              }
            </Button>
            <Button
              variant="outline"
              onClick={handleResetFilters}
              disabled={isLoadingFilters || !hasFilterChanges}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'codexlens.advanced.reset', defaultMessage: 'Reset' })}
            </Button>
            <Button
              variant="outline"
              onClick={handleRestoreDefaultFilters}
              disabled={isLoadingFilters || isUpdatingPatterns}
            >
              {formatMessage({
                id: 'codexlens.advanced.restoreDefaults',
                defaultMessage: 'Restore defaults',
              })}
            </Button>
          </div>
        </div>
      </Card>

      {/* Environment Variables Editor */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileCode className="w-5 h-5 text-muted-foreground" />
            <h3 className="text-lg font-semibold text-foreground">
              {formatMessage({ id: 'codexlens.advanced.envEditor' })}
            </h3>
          </div>
          <Badge variant="outline" className="text-xs">
            {formatMessage({ id: 'codexlens.advanced.envFile' })}: .env
          </Badge>
        </div>

        <div className="space-y-4">
          {/* Env Textarea */}
          <div className="space-y-2">
            <Label htmlFor="env-input">
              {formatMessage({ id: 'codexlens.advanced.envContent' })}
            </Label>
            <Textarea
              id="env-input"
              value={envInput}
              onChange={(e) => handleEnvChange(e.target.value)}
              placeholder={formatMessage({ id: 'codexlens.advanced.envPlaceholder' })}
              className={cn(
                'min-h-[300px] font-mono text-sm',
                errors.env && 'border-destructive focus-visible:ring-destructive'
              )}
              disabled={isLoading}
            />
            {errors.env && (
              <p className="text-sm text-destructive">{errors.env}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {formatMessage({ id: 'codexlens.advanced.envHint' })}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSave}
              disabled={isLoading || isUpdating || !hasChanges}
            >
              <Save className={cn('w-4 h-4 mr-2', isUpdating && 'animate-spin')} />
              {isUpdating
                ? formatMessage({ id: 'codexlens.advanced.saving' })
                : formatMessage({ id: 'codexlens.advanced.save' })
              }
            </Button>
            <Button
              variant="outline"
              onClick={handleReset}
              disabled={isLoading || !hasChanges}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {formatMessage({ id: 'codexlens.advanced.reset' })}
            </Button>
          </div>
        </div>
      </Card>

      {/* Help Card */}
      <Card className="p-4 bg-info/10 border-info/20">
        <h4 className="text-sm font-medium text-info-foreground mb-2">
          {formatMessage({ id: 'codexlens.advanced.helpTitle' })}
        </h4>
        <ul className="text-xs text-info-foreground/80 space-y-1">
          <li>• {formatMessage({ id: 'codexlens.advanced.helpComment' })}</li>
          <li>• {formatMessage({ id: 'codexlens.advanced.helpFormat' })}</li>
          <li>• {formatMessage({ id: 'codexlens.advanced.helpQuotes' })}</li>
          <li>• {formatMessage({ id: 'codexlens.advanced.helpRestart' })}</li>
        </ul>
      </Card>
    </div>
  );
}

export default AdvancedTab;
