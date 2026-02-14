// ========================================
// TeamArtifacts Component
// ========================================
// Displays team artifacts grouped by pipeline phase (plan/impl/test/review)

import * as React from 'react';
import { useIntl } from 'react-intl';
import {
  FileText,
  ClipboardList,
  Code2,
  TestTube2,
  SearchCheck,
  Database,
  Package,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import MarkdownModal from '@/components/shared/MarkdownModal';
import { fetchFileContent } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { TeamMessage } from '@/types/team';

// ========================================
// Types
// ========================================

type ArtifactPhase = 'plan' | 'impl' | 'test' | 'review';

interface Artifact {
  id: string;
  message: TeamMessage;
  phase: ArtifactPhase;
  ref?: string;
}

interface TeamArtifactsProps {
  messages: TeamMessage[];
}

// ========================================
// Constants
// ========================================

const PHASE_MESSAGE_MAP: Record<string, ArtifactPhase> = {
  plan_ready: 'plan',
  plan_approved: 'plan',
  plan_revision: 'plan',
  impl_complete: 'impl',
  impl_progress: 'impl',
  test_result: 'test',
  review_result: 'review',
};

const PHASE_CONFIG: Record<ArtifactPhase, { icon: typeof FileText; color: string }> = {
  plan: { icon: ClipboardList, color: 'text-blue-500' },
  impl: { icon: Code2, color: 'text-green-500' },
  test: { icon: TestTube2, color: 'text-amber-500' },
  review: { icon: SearchCheck, color: 'text-purple-500' },
};

const PHASE_ORDER: ArtifactPhase[] = ['plan', 'impl', 'test', 'review'];

// ========================================
// Helpers
// ========================================

function extractArtifacts(messages: TeamMessage[]): Artifact[] {
  const artifacts: Artifact[] = [];
  for (const msg of messages) {
    const phase = PHASE_MESSAGE_MAP[msg.type];
    if (!phase) continue;
    // Include messages that have ref OR data (inline artifacts)
    if (!msg.ref && !msg.data) continue;
    artifacts.push({
      id: msg.id,
      message: msg,
      phase,
      ref: msg.ref,
    });
  }
  return artifacts;
}

function groupByPhase(artifacts: Artifact[]): Record<ArtifactPhase, Artifact[]> {
  const groups: Record<ArtifactPhase, Artifact[]> = {
    plan: [],
    impl: [],
    test: [],
    review: [],
  };
  for (const a of artifacts) {
    groups[a.phase].push(a);
  }
  return groups;
}

function getContentType(ref: string): 'markdown' | 'json' | 'text' {
  if (ref.endsWith('.json')) return 'json';
  if (ref.endsWith('.md')) return 'markdown';
  return 'text';
}

function formatTimestamp(ts: string): string {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return ts;
  }
}

// ========================================
// Sub-components
// ========================================

function ArtifactCard({
  artifact,
  onView,
}: {
  artifact: Artifact;
  onView: (artifact: Artifact) => void;
}) {
  const { formatMessage } = useIntl();
  const config = PHASE_CONFIG[artifact.phase];
  const Icon = config.icon;

  return (
    <Card
      className="cursor-pointer hover:bg-accent/50 transition-colors"
      onClick={() => onView(artifact)}
    >
      <CardContent className="p-3 flex items-start gap-3">
        <div className={cn('mt-0.5', config.color)}>
          {artifact.ref ? (
            <Icon className="w-4 h-4" />
          ) : (
            <Database className="w-4 h-4" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{artifact.message.summary}</p>
          <div className="flex items-center gap-2 mt-1">
            {artifact.ref ? (
              <span className="text-xs text-muted-foreground font-mono truncate">
                {artifact.ref.split('/').pop()}
              </span>
            ) : (
              <Badge variant="outline" className="text-[10px]">
                {formatMessage({ id: 'team.artifacts.noRef' })}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
              {formatTimestamp(artifact.message.ts)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function PhaseGroup({
  phase,
  artifacts,
  onView,
}: {
  phase: ArtifactPhase;
  artifacts: Artifact[];
  onView: (artifact: Artifact) => void;
}) {
  const { formatMessage } = useIntl();
  if (artifacts.length === 0) return null;

  const config = PHASE_CONFIG[phase];
  const Icon = config.icon;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn('w-4 h-4', config.color)} />
        <h4 className="text-sm font-medium">
          {formatMessage({ id: `team.artifacts.${phase}` })}
        </h4>
        <Badge variant="secondary" className="text-[10px]">
          {artifacts.length}
        </Badge>
      </div>
      <div className="space-y-2 pl-6">
        {artifacts.map((artifact) => (
          <ArtifactCard key={artifact.id} artifact={artifact} onView={onView} />
        ))}
      </div>
    </div>
  );
}

// ========================================
// Main Component
// ========================================

export function TeamArtifacts({ messages }: TeamArtifactsProps) {
  const { formatMessage } = useIntl();
  const [selectedArtifact, setSelectedArtifact] = React.useState<Artifact | null>(null);
  const [modalContent, setModalContent] = React.useState('');
  const [isLoading, setIsLoading] = React.useState(false);

  const artifacts = React.useMemo(() => extractArtifacts(messages), [messages]);
  const grouped = React.useMemo(() => groupByPhase(artifacts), [artifacts]);

  const handleView = React.useCallback(async (artifact: Artifact) => {
    setSelectedArtifact(artifact);

    if (artifact.ref) {
      setIsLoading(true);
      setModalContent('');
      try {
        const result = await fetchFileContent(artifact.ref);
        setModalContent(result.content);
      } catch {
        setModalContent(`Failed to load: ${artifact.ref}`);
      } finally {
        setIsLoading(false);
      }
    } else if (artifact.message.data) {
      setModalContent(JSON.stringify(artifact.message.data, null, 2));
    } else {
      setModalContent(artifact.message.summary);
    }
  }, []);

  const handleClose = React.useCallback(() => {
    setSelectedArtifact(null);
    setModalContent('');
  }, []);

  // Empty state
  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Package className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          {formatMessage({ id: 'team.artifacts.noArtifacts' })}
        </h3>
      </div>
    );
  }

  // Determine content type for modal
  const modalContentType = selectedArtifact?.ref
    ? getContentType(selectedArtifact.ref)
    : selectedArtifact?.message.data
      ? 'json'
      : 'text';

  const modalTitle = selectedArtifact?.ref
    ? selectedArtifact.ref.split('/').pop() || 'File'
    : selectedArtifact?.message.summary || 'Data';

  return (
    <>
      <div className="space-y-6">
        {PHASE_ORDER.map((phase) => (
          <PhaseGroup
            key={phase}
            phase={phase}
            artifacts={grouped[phase]}
            onView={handleView}
          />
        ))}
      </div>

      {selectedArtifact && (
        <MarkdownModal
          isOpen={!!selectedArtifact}
          onClose={handleClose}
          title={modalTitle}
          content={modalContent}
          contentType={modalContentType}
          maxWidth="3xl"
          isLoading={isLoading}
        />
      )}
    </>
  );
}
