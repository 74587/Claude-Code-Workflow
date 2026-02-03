// ========================================
// SkillDetailPanel Component
// ========================================
// Right-side slide-out panel for viewing skill details

import { useEffect } from 'react';
import { useIntl } from 'react-intl';
import {
  X,
  FileText,
  Edit,
  Trash2,
  Folder,
  Lock,
  Tag,
  MapPin,
  Code,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import type { Skill } from '@/lib/api';

export interface SkillDetailPanelProps {
  skill: Skill | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (skill: Skill) => void;
  onDelete?: (skill: Skill) => void;
  onEditFile?: (skillName: string, fileName: string, location: 'project' | 'user') => void;
  isLoading?: boolean;
}

export function SkillDetailPanel({
  skill,
  isOpen,
  onClose,
  onEdit,
  onDelete,
  onEditFile,
  isLoading = false,
}: SkillDetailPanelProps) {
  const { formatMessage } = useIntl();

  // Prevent body scroll when panel is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen || !skill) {
    return null;
  }

  const hasAllowedTools = skill.allowedTools && skill.allowedTools.length > 0;
  const hasSupportingFiles = skill.supportingFiles && skill.supportingFiles.length > 0;
  const folderName = skill.folderName || skill.name;

  const handleEditFile = (fileName: string) => {
    onEditFile?.(folderName, fileName, skill.location || 'project');
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 w-full sm:w-[480px] md:w-[560px] lg:w-[640px] h-full bg-background border-l border-border shadow-xl z-50 flex flex-col transition-transform">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              'p-2 rounded-lg flex-shrink-0',
              skill.enabled ? 'bg-primary/10' : 'bg-muted'
            )}>
              <Tag className={cn('w-5 h-5', skill.enabled ? 'text-primary' : 'text-muted-foreground')} />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-foreground truncate">{skill.name}</h3>
              {skill.version && (
                <p className="text-sm text-muted-foreground">v{skill.version}</p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin text-muted-foreground">
                <Tag className="w-8 h-8" />
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Description */}
              <section>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  {formatMessage({ id: 'skills.card.description' })}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {skill.description || formatMessage({ id: 'skills.noDescription' })}
                </p>
              </section>

              {/* Metadata */}
              <section>
                <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {formatMessage({ id: 'skills.metadata' })}
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <Card className="p-3 bg-muted/50">
                    <span className="text-xs text-muted-foreground block mb-1">
                      {formatMessage({ id: 'skills.location' })}
                    </span>
                    <p className="text-sm font-medium text-foreground">
                      {skill.location === 'project' ? formatMessage({ id: 'skills.projectSkills' }) : formatMessage({ id: 'skills.userSkills' })}
                    </p>
                  </Card>
                  {skill.version && (
                    <Card className="p-3 bg-muted/50">
                      <span className="text-xs text-muted-foreground block mb-1">
                        {formatMessage({ id: 'skills.card.version' })}
                      </span>
                      <p className="text-sm font-medium text-foreground">v{skill.version}</p>
                    </Card>
                  )}
                  {skill.author && (
                    <Card className="p-3 bg-muted/50">
                      <span className="text-xs text-muted-foreground block mb-1">
                        {formatMessage({ id: 'skills.card.author' })}
                      </span>
                      <p className="text-sm font-medium text-foreground">{skill.author}</p>
                    </Card>
                  )}
                  {skill.source && (
                    <Card className="p-3 bg-muted/50">
                      <span className="text-xs text-muted-foreground block mb-1">
                        {formatMessage({ id: 'skills.card.source' })}
                      </span>
                      <p className="text-sm font-medium text-foreground">
                        {formatMessage({ id: `skills.source.${skill.source}` })}
                      </p>
                    </Card>
                  )}
                </div>
              </section>

              {/* Triggers */}
              {skill.triggers && skill.triggers.length > 0 && (
                <section>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Tag className="w-4 h-4 text-muted-foreground" />
                    {formatMessage({ id: 'skills.card.triggers' })}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {skill.triggers.map((trigger) => (
                      <Badge key={trigger} variant="secondary" className="text-sm">
                        {trigger}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {/* Allowed Tools */}
              {hasAllowedTools && (
                <section>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    {formatMessage({ id: 'skills.allowedTools' })}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {skill.allowedTools!.map((tool) => (
                      <Badge key={tool} variant="outline" className="text-xs font-mono">
                        {tool}
                      </Badge>
                    ))}
                  </div>
                </section>
              )}

              {/* Files */}
              <section>
                <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Folder className="w-4 h-4 text-muted-foreground" />
                  {formatMessage({ id: 'skills.files' })}
                </h4>
                <div className="space-y-2">
                  {/* SKILL.md (main file) */}
                  <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg hover:bg-primary/10 transition-colors">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <span className="text-sm font-mono text-foreground font-medium">SKILL.md</span>
                    </div>
                    {onEditFile && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-primary hover:bg-primary/20"
                        onClick={() => handleEditFile('SKILL.md')}
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>

                  {/* Supporting Files */}
                  {hasSupportingFiles && skill.supportingFiles!.map((file) => {
                    const isDir = file.endsWith('/');
                    const displayName = isDir ? file.slice(0, -1) : file;
                    return (
                      <div
                        key={file}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          {isDir ? (
                            <Folder className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <FileText className="w-4 h-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-mono text-foreground">{displayName}</span>
                        </div>
                        {!isDir && onEditFile && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleEditFile(file)}
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Path */}
              {skill.path && (
                <section>
                  <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Code className="w-4 h-4 text-muted-foreground" />
                    {formatMessage({ id: 'skills.path' })}
                  </h4>
                  <Card className="p-3 bg-muted">
                    <code className="text-xs font-mono text-muted-foreground break-all">
                      {skill.path}
                    </code>
                  </Card>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-border flex justify-between">
          {onDelete && (
            <Button
              variant="destructive"
              onClick={() => onDelete(skill)}
              className="flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              {formatMessage({ id: 'common.actions.delete' })}
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            {onEdit && (
              <Button
                variant="outline"
                onClick={() => onEdit(skill)}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                {formatMessage({ id: 'common.actions.edit' })}
              </Button>
            )}
            <Button onClick={onClose}>
              {formatMessage({ id: 'common.actions.close' })}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

export default SkillDetailPanel;
