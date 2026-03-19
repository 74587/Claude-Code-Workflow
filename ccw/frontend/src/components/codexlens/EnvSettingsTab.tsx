// ========================================
// EnvSettingsTab Component
// ========================================
// Grouped env var form with save/reset actions

import { useState, useEffect } from 'react';
import { useIntl } from 'react-intl';
import { Eye, EyeOff, Save, RotateCcw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useCodexLensEnv, useSaveCodexLensEnv } from '@/hooks/useCodexLens';

type EmbedMode = 'local' | 'api';

// ========================================
// ENV group definitions
// ========================================

interface EnvField {
  key: string;
  label: string;
  sensitive?: boolean;
}

interface EnvGroup {
  title: string;
  fields: EnvField[];
}

const ENV_GROUPS: EnvGroup[] = [
  {
    title: 'embed',
    fields: [
      { key: 'CODEXLENS_EMBED_API_URL', label: 'Embed API URL' },
      { key: 'CODEXLENS_EMBED_API_KEY', label: 'Embed API Key', sensitive: true },
      { key: 'CODEXLENS_EMBED_API_MODEL', label: 'Embed API Model' },
      { key: 'CODEXLENS_EMBED_DIM', label: 'Embed Dimension' },
      { key: 'CODEXLENS_EMBED_API_ENDPOINTS', label: 'Embed API Endpoints', sensitive: true },
      { key: 'CODEXLENS_EMBED_BATCH_SIZE', label: 'Embed Batch Size' },
      { key: 'CODEXLENS_EMBED_API_CONCURRENCY', label: 'Embed API Concurrency' },
    ],
  },
  {
    title: 'reranker',
    fields: [
      { key: 'CODEXLENS_RERANKER_API_URL', label: 'Reranker API URL' },
      { key: 'CODEXLENS_RERANKER_API_KEY', label: 'Reranker API Key', sensitive: true },
      { key: 'CODEXLENS_RERANKER_API_MODEL', label: 'Reranker API Model' },
    ],
  },
  {
    title: 'performance',
    fields: [
      { key: 'CODEXLENS_BINARY_TOP_K', label: 'Binary Top K' },
      { key: 'CODEXLENS_ANN_TOP_K', label: 'ANN Top K' },
      { key: 'CODEXLENS_FTS_TOP_K', label: 'FTS Top K' },
      { key: 'CODEXLENS_FUSION_K', label: 'Fusion K' },
      { key: 'CODEXLENS_RERANKER_TOP_K', label: 'Reranker Top K' },
      { key: 'CODEXLENS_RERANKER_BATCH_SIZE', label: 'Reranker Batch Size' },
    ],
  },
  {
    title: 'index',
    fields: [
      { key: 'CODEXLENS_DB_PATH', label: 'DB Path' },
      { key: 'CODEXLENS_INDEX_WORKERS', label: 'Index Workers' },
      { key: 'CODEXLENS_CODE_AWARE_CHUNKING', label: 'Code Aware Chunking' },
      { key: 'CODEXLENS_MAX_FILE_SIZE', label: 'Max File Size' },
      { key: 'CODEXLENS_HNSW_EF', label: 'HNSW EF' },
      { key: 'CODEXLENS_HNSW_M', label: 'HNSW M' },
    ],
  },
];

// Fields that are only relevant in API mode
const API_ONLY_KEYS = new Set([
  'CODEXLENS_EMBED_API_URL',
  'CODEXLENS_EMBED_API_KEY',
  'CODEXLENS_EMBED_API_ENDPOINTS',
  'CODEXLENS_EMBED_API_CONCURRENCY',
]);

// Default placeholder values
const FIELD_DEFAULTS: Record<string, string> = {
  CODEXLENS_EMBED_API_MODEL: 'text-embedding-3-small',
  CODEXLENS_EMBED_DIM: '1536',
  CODEXLENS_EMBED_BATCH_SIZE: '64',
  CODEXLENS_EMBED_API_CONCURRENCY: '4',
  CODEXLENS_BINARY_TOP_K: '200',
  CODEXLENS_ANN_TOP_K: '50',
  CODEXLENS_FTS_TOP_K: '50',
  CODEXLENS_FUSION_K: '60',
  CODEXLENS_RERANKER_TOP_K: '20',
  CODEXLENS_RERANKER_BATCH_SIZE: '32',
  CODEXLENS_INDEX_WORKERS: '2',
  CODEXLENS_CODE_AWARE_CHUNKING: 'true',
  CODEXLENS_MAX_FILE_SIZE: '1000000',
  CODEXLENS_HNSW_EF: '150',
  CODEXLENS_HNSW_M: '32',
};

// Collect all keys
const ALL_KEYS = ENV_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

function buildEmptyEnv(): Record<string, string> {
  return Object.fromEntries(ALL_KEYS.map((k) => [k, '']));
}

function buildEffectiveEnv(
  values: Record<string, string>,
  defaults: Record<string, string>,
): Record<string, string> {
  return Object.fromEntries(
    ALL_KEYS.map((key) => [key, values[key] ?? defaults[key] ?? '']),
  );
}

// ========================================
// Sensitive field with show/hide toggle
// ========================================

interface SensitiveInputProps {
  value: string;
  onChange: (v: string) => void;
  id: string;
}

function SensitiveInput({ value, onChange, id }: SensitiveInputProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
      />
      <button
        type="button"
        className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
        onClick={() => setShow((s) => !s)}
        tabIndex={-1}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ========================================
// Main component
// ========================================

export function EnvSettingsTab() {
  const { formatMessage } = useIntl();
  const { data: envData, isLoading } = useCodexLensEnv();
  const { saveEnv, isSaving } = useSaveCodexLensEnv();

  const [embedMode, setEmbedMode] = useState<EmbedMode>('local');
  const [localEnv, setLocalEnv] = useState<Record<string, string>>(buildEmptyEnv);

  const serverValues = envData?.values ?? {};
  const serverDefaults = { ...FIELD_DEFAULTS, ...(envData?.defaults ?? {}) };
  const serverRecord = buildEffectiveEnv(serverValues, serverDefaults);

  // Sync server state into local when loaded and detect embed mode
  useEffect(() => {
    if (envData) {
      const nextDefaults = { ...FIELD_DEFAULTS, ...(envData.defaults ?? {}) };
      const nextValues = envData.values ?? {};
      setLocalEnv(buildEffectiveEnv(nextValues, nextDefaults));
      // Auto-detect mode from saved env
      if (nextValues.CODEXLENS_EMBED_API_URL) {
        setEmbedMode('api');
      }
    }
  }, [envData]);

  const isDirty = ALL_KEYS.some((k) => localEnv[k] !== (serverRecord[k] ?? ''));

  const handleChange = (key: string, value: string) => {
    setLocalEnv((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    const payload = Object.fromEntries(
      Object.entries(localEnv).flatMap(([key, value]) => {
        const trimmed = value.trim();
        const defaultValue = serverDefaults[key] ?? '';
        if (!trimmed || trimmed === defaultValue) {
          return [];
        }
        return [[key, trimmed]];
      }),
    );
    await saveEnv(payload);
  };

  const handleReset = () => {
    setLocalEnv(buildEmptyEnv());
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-4">{formatMessage({ id: 'codexlens.env.loading' })}</p>;
  }

  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">{formatMessage({ id: 'codexlens.env.mode' })}:</span>
        <div className="flex rounded-md border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setEmbedMode('local')}
            className={`px-3 py-1.5 text-sm transition-colors ${
              embedMode === 'local'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            {formatMessage({ id: 'codexlens.env.localMode' })}
          </button>
          <button
            type="button"
            onClick={() => setEmbedMode('api')}
            className={`px-3 py-1.5 text-sm transition-colors ${
              embedMode === 'api'
                ? 'bg-primary text-primary-foreground'
                : 'bg-background text-muted-foreground hover:bg-muted'
            }`}
          >
            {formatMessage({ id: 'codexlens.env.apiMode' })}
          </button>
        </div>
        <span className="text-xs text-muted-foreground">
          {embedMode === 'local'
            ? formatMessage({ id: 'codexlens.env.localModeDesc' })
            : formatMessage({ id: 'codexlens.env.apiModeDesc' })}
        </span>
      </div>

      {ENV_GROUPS.map((group) => {
        // In local mode, filter out API-only fields from embed group
        const visibleFields = embedMode === 'local'
          ? group.fields.filter((f) => !API_ONLY_KEYS.has(f.key))
          : group.fields;
        if (visibleFields.length === 0) return null;
        return (
        <Card key={group.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{formatMessage({ id: `codexlens.env.sections.${group.title}` })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleFields.map((field) => (
              <div key={field.key} className="grid grid-cols-3 gap-3 items-center">
                <label
                  htmlFor={field.key}
                  className="text-sm text-muted-foreground col-span-1"
                >
                  {field.label}
                </label>
                <div className="col-span-2">
                  {field.sensitive ? (
                    <SensitiveInput
                      id={field.key}
                      value={localEnv[field.key] ?? ''}
                      onChange={(v) => handleChange(field.key, v)}
                    />
                  ) : (
                    <Input
                      id={field.key}
                      value={localEnv[field.key] ?? ''}
                      placeholder={serverDefaults[field.key] ?? ''}
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
        );
      })}

      {/* Action buttons */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={handleReset}>
          <RotateCcw className="w-4 h-4 mr-2" />
          {formatMessage({ id: 'codexlens.env.clearForm' })}
        </Button>
        <Button onClick={handleSave} disabled={!isDirty || isSaving}>
          <Save className="w-4 h-4 mr-2" />
          {isSaving ? formatMessage({ id: 'codexlens.env.saving' }) : formatMessage({ id: 'codexlens.env.save' })}
        </Button>
      </div>
    </div>
  );
}
