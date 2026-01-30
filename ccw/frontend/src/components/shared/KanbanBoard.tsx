// ========================================
// KanbanBoard Component
// ========================================
// Drag-and-drop kanban board for loops and tasks

import { useCallback } from 'react';
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
  type DraggableProvided,
  type DroppableProvided,
} from '@hello-pangea/dnd';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

// ========== Types ==========

export interface KanbanItem {
  id: string;
  title?: string;
  status: string;
  [key: string]: unknown;
}

export interface KanbanColumn<T extends KanbanItem = KanbanItem> {
  id: string;
  title: string;
  items: T[];
  color?: string;
  icon?: React.ReactNode;
}

export interface KanbanBoardProps<T extends KanbanItem = KanbanItem> {
  columns: KanbanColumn<T>[];
  onDragEnd?: (result: DropResult, sourceColumn: string, destColumn: string) => void;
  onItemClick?: (item: T) => void;
  renderItem?: (item: T, provided: DraggableProvided) => React.ReactNode;
  className?: string;
  columnClassName?: string;
  itemClassName?: string;
  emptyColumnMessage?: string;
  isLoading?: boolean;
}

// ========== Default Item Renderer ==========

function DefaultItemRenderer<T extends KanbanItem>({
  item,
  provided,
  onClick,
  className,
}: {
  item: T;
  provided: DraggableProvided;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      ref={provided.innerRef}
      {...provided.draggableProps}
      {...provided.dragHandleProps}
      onClick={onClick}
      className={cn(
        'p-3 bg-card border border-border rounded-lg shadow-sm cursor-pointer',
        'hover:shadow-md hover:border-primary/50 transition-all',
        'focus:outline-none focus:ring-2 focus:ring-primary/50',
        className
      )}
    >
      <p className="text-sm font-medium text-foreground truncate">
        {item.title || item.id}
      </p>
    </div>
  );
}

// ========== Column Component ==========

function KanbanColumnComponent<T extends KanbanItem>({
  column,
  onItemClick,
  renderItem,
  itemClassName,
  emptyMessage,
}: {
  column: KanbanColumn<T>;
  onItemClick?: (item: T) => void;
  renderItem?: (item: T, provided: DraggableProvided) => React.ReactNode;
  itemClassName?: string;
  emptyMessage?: string;
}) {
  return (
    <Droppable droppableId={column.id}>
      {(provided: DroppableProvided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={cn(
            'min-h-[200px] p-2 space-y-2 rounded-lg transition-colors',
            snapshot.isDraggingOver && 'bg-primary/5'
          )}
        >
          {column.items.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">
              {emptyMessage || 'No items'}
            </p>
          ) : (
            column.items.map((item, index) => (
              <Draggable key={item.id} draggableId={item.id} index={index}>
                {(dragProvided: DraggableProvided) =>
                  renderItem ? (
                    renderItem(item, dragProvided)
                  ) : (
                    <DefaultItemRenderer
                      item={item}
                      provided={dragProvided}
                      onClick={() => onItemClick?.(item)}
                      className={itemClassName}
                    />
                  )
                }
              </Draggable>
            ))
          )}
          {provided.placeholder}
        </div>
      )}
    </Droppable>
  );
}

// ========== Main Kanban Board Component ==========

export function KanbanBoard<T extends KanbanItem = KanbanItem>({
  columns,
  onDragEnd,
  onItemClick,
  renderItem,
  className,
  columnClassName,
  itemClassName,
  emptyColumnMessage,
  isLoading = false,
}: KanbanBoardProps<T>) {
  const handleDragEnd = useCallback(
    (result: DropResult) => {
      if (!result.destination) return;

      const { source, destination } = result;
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return;
      }

      onDragEnd?.(result, source.droppableId, destination.droppableId);
    },
    [onDragEnd]
  );

  if (isLoading) {
    return (
      <div className={cn('grid gap-4', className)} style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}>
        {columns.map((column) => (
          <Card key={column.id} className={cn('p-4', columnClassName)}>
            <div className="h-6 w-24 bg-muted animate-pulse rounded mb-4" />
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 bg-muted animate-pulse rounded" />
              ))}
            </div>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div
        className={cn('grid gap-4', className)}
        style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }}
      >
        {columns.map((column) => (
          <Card key={column.id} className={cn('p-4', columnClassName)}>
            {/* Column Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                {column.icon}
                <h3 className="font-medium text-foreground">{column.title}</h3>
              </div>
              <Badge
                variant="secondary"
                className={cn(column.color && `bg-${column.color}/10 text-${column.color}`)}
              >
                {column.items.length}
              </Badge>
            </div>

            {/* Column Content */}
            <KanbanColumnComponent
              column={column}
              onItemClick={onItemClick}
              renderItem={renderItem}
              itemClassName={itemClassName}
              emptyMessage={emptyColumnMessage}
            />
          </Card>
        ))}
      </div>
    </DragDropContext>
  );
}

// ========== Loop-specific Kanban ==========

export interface LoopKanbanItem extends KanbanItem {
  status: 'created' | 'running' | 'paused' | 'completed' | 'failed';
  currentStep?: number;
  totalSteps?: number;
  prompt?: string;
  tool?: string;
}

export function useLoopKanbanColumns(loopsByStatus: Record<string, LoopKanbanItem[]>): KanbanColumn<LoopKanbanItem>[] {
  return [
    {
      id: 'created',
      title: 'Pending',
      items: loopsByStatus.created || [],
      color: 'muted',
    },
    {
      id: 'running',
      title: 'Running',
      items: loopsByStatus.running || [],
      color: 'primary',
    },
    {
      id: 'paused',
      title: 'Paused',
      items: loopsByStatus.paused || [],
      color: 'warning',
    },
    {
      id: 'completed',
      title: 'Completed',
      items: loopsByStatus.completed || [],
      color: 'success',
    },
    {
      id: 'failed',
      title: 'Failed',
      items: loopsByStatus.failed || [],
      color: 'destructive',
    },
  ];
}

export default KanbanBoard;
