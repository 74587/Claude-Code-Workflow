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

// Collect all keys
const ALL_KEYS = ENV_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

function buildEmptyEnv(): Record<string, string> {
  return Object.fromEntries(ALL_KEYS.map((k) => [k, '']));
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
  const { data: serverEnv, isLoading } = useCodexLensEnv();
  const { saveEnv, isSaving } = useSaveCodexLensEnv();

  const [localEnv, setLocalEnv] = useState<Record<string, string>>(buildEmptyEnv);

  // Sync server state into local when loaded
  useEffect(() => {
    if (serverEnv) {
      setLocalEnv((prev) => {
        const next = { ...prev };
        ALL_KEYS.forEach((k) => {
          next[k] = serverEnv[k] ?? '';
        });
        return next;
      });
    }
  }, [serverEnv]);

  const serverRecord = serverEnv ?? {};

  const isDirty = ALL_KEYS.some((k) => localEnv[k] !== (serverRecord[k] ?? ''));

  const handleChange = (key: string, value: string) => {
    setLocalEnv((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    await saveEnv(localEnv);
  };

  const handleReset = () => {
    setLocalEnv(buildEmptyEnv());
  };

  if (isLoading) {
    return <p className="text-sm text-muted-foreground p-4">{formatMessage({ id: 'codexlens.env.loading' })}</p>;
  }

  return (
    <div className="space-y-6">
      {ENV_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{formatMessage({ id: `codexlens.env.sections.${group.title}` })}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {group.fields.map((field) => (
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
                      onChange={(e) => handleChange(field.key, e.target.value)}
                    />
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

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
