// ========================================
// SessionGroupTree Component
// ========================================
// Tree view for session groups with drag-and-drop support.
// Sessions can be dragged between groups. Groups are expandable sections.
// Uses @hello-pangea/dnd for drag-and-drop, sessionManagerStore for state.

import { useState, useCallback, useMemo } from 'react';
import { useIntl } from 'react-intl';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd';
import {
  ChevronRight,
  FolderOpen,
  Folder,
  Plus,
  Terminal,
  GripVertical,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSessionManagerStore, selectGroups, selectSessionManagerActiveTerminalId } from '@/stores';
import { useCliSessionStore } from '@/stores/cliSessionStore';
import { Badge } from '@/components/ui/Badge';

// ========== SessionGroupTree Component ==========

export function SessionGroupTree() {
  const { formatMessage } = useIntl();
  const groups = useSessionManagerStore(selectGroups);
  const activeTerminalId = useSessionManagerStore(selectSessionManagerActiveTerminalId);
  const createGroup = useSessionManagerStore((s) => s.createGroup);
  const moveSessionToGroup = useSessionManagerStore((s) => s.moveSessionToGroup);
  const setActiveTerminal = useSessionManagerStore((s) => s.setActiveTerminal);
  const sessions = useCliSessionStore((s) => s.sessions);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  const handleCreateGroup = useCallback(() => {
    const name = formatMessage({ id: 'terminalDashboard.sessionTree.defaultGroupName' });
    createGroup(name);
  }, [createGroup, formatMessage]);

  const handleSessionClick = useCallback(
    (sessionId: string) => {
      setActiveTerminal(sessionId);
    },
    [setActiveTerminal]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      const { draggableId, destination } = result;
      if (!destination) return;

      // destination.droppableId is the target group ID
      const targetGroupId = destination.droppableId;
      moveSessionToGroup(draggableId, targetGroupId);
    },
    [moveSessionToGroup]
  );

  // Build a lookup for session display names
  const sessionNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [key, meta] of Object.entries(sessions)) {
      map[key] = meta.tool ? `${meta.tool} - ${meta.shellKind}` : meta.shellKind;
    }
    return map;
  }, [sessions]);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="px-3 py-2 border-b border-border">
          <button
            onClick={handleCreateGroup}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            {formatMessage({ id: 'terminalDashboard.sessionTree.createGroup' })}
          </button>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-1.5 text-muted-foreground p-4">
          <Folder className="w-6 h-6 opacity-30" />
          <p className="text-xs text-center">
            {formatMessage({ id: 'terminalDashboard.sessionTree.noGroups' })}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Create group button */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <button
          onClick={handleCreateGroup}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          {formatMessage({ id: 'terminalDashboard.sessionTree.createGroup' })}
        </button>
      </div>

      {/* Groups with drag-and-drop */}
      <div className="flex-1 overflow-y-auto">
        <DragDropContext onDragEnd={handleDragEnd}>
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);
            return (
              <div key={group.id} className="border-b border-border/50 last:border-b-0">
                {/* Group header */}
                <button
                  onClick={() => toggleGroup(group.id)}
                  className={cn(
                    'flex items-center gap-1.5 w-full px-3 py-2 text-left',
                    'hover:bg-muted/50 transition-colors text-sm'
                  )}
                >
                  <ChevronRight
                    className={cn(
                      'w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0',
                      isExpanded && 'rotate-90'
                    )}
                  />
                  {isExpanded ? (
                    <FolderOpen className="w-4 h-4 text-blue-500 shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 text-blue-400 shrink-0" />
                  )}
                  <span className="flex-1 truncate font-medium">{group.name}</span>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                    {group.sessionIds.length}
                  </Badge>
                </button>

                {/* Expanded: droppable session list */}
                {isExpanded && (
                  <Droppable droppableId={group.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          'min-h-[32px] pb-1',
                          snapshot.isDraggingOver && 'bg-primary/5'
                        )}
                      >
                        {group.sessionIds.length === 0 ? (
                          <p className="px-8 py-2 text-xs text-muted-foreground italic">
                            {formatMessage({ id: 'terminalDashboard.sessionTree.emptyGroup' })}
                          </p>
                        ) : (
                          group.sessionIds.map((sessionId, index) => (
                            <Draggable
                              key={sessionId}
                              draggableId={sessionId}
                              index={index}
                            >
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  className={cn(
                                    'flex items-center gap-1.5 mx-1 px-2 py-1.5 rounded-sm cursor-pointer',
                                    'hover:bg-muted/50 transition-colors text-sm',
                                    activeTerminalId === sessionId && 'bg-primary/10 text-primary',
                                    dragSnapshot.isDragging && 'bg-muted shadow-md'
                                  )}
                                  onClick={() => handleSessionClick(sessionId)}
                                >
                                  <span
                                    {...dragProvided.dragHandleProps}
                                    className="text-muted-foreground/50 hover:text-muted-foreground shrink-0"
                                  >
                                    <GripVertical className="w-3 h-3" />
                                  </span>
                                  <Terminal className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                  <span className="flex-1 truncate text-xs">
                                    {sessionNames[sessionId] ?? sessionId}
                                  </span>
                                </div>
                              )}
                            </Draggable>
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                )}
              </div>
            );
          })}
        </DragDropContext>
      </div>
    </div>
  );
}

export default SessionGroupTree;
