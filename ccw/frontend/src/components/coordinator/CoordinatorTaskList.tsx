// ========================================
// CoordinatorTaskList Component
// ========================================
// Horizontal scrolling task list with filter and sort controls

import { useState, useMemo } from 'react';
import { useIntl } from 'react-intl';
import { Filter, ArrowUpDown, Inbox } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import { CoordinatorTaskCard, TaskStatus } from './CoordinatorTaskCard';
import { cn } from '@/lib/utils';

export type FilterOption = 'all' | 'running' | 'completed' | 'failed';
export type SortOption = 'time' | 'name';

export interface CoordinatorTaskListProps {
  tasks: TaskStatus[];
  selectedTaskId: string | null;
  onTaskSelect: (taskId: string) => void;
  className?: string;
}

/**
 * Horizontal scrolling task list with filtering and sorting
 * Displays task cards in a row with overflow scroll
 */
export function CoordinatorTaskList({
  tasks,
  selectedTaskId,
  onTaskSelect,
  className,
}: CoordinatorTaskListProps) {
  const { formatMessage } = useIntl();
  const [filter, setFilter] = useState<FilterOption>('all');
  const [sort, setSort] = useState<SortOption>('time');

  // Filter tasks
  const filteredTasks = useMemo(() => {
    let result = [...tasks];

    // Apply filter
    if (filter !== 'all') {
      result = result.filter((task) => task.status === filter);
    }

    // Apply sort
    result.sort((a, b) => {
      if (sort === 'time') {
        // Sort by start time (newest first), pending tasks last
        const timeA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const timeB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return timeB - timeA;
      } else {
        // Sort by name alphabetically
        return a.name.localeCompare(b.name);
      }
    });

    return result;
  }, [tasks, filter, sort]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Controls Row */}
      <div className="flex items-center gap-3">
        {/* Filter Select */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={filter} onValueChange={(v) => setFilter(v as FilterOption)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {formatMessage({ id: 'coordinator.taskList.filter.all' })}
              </SelectItem>
              <SelectItem value="running">
                {formatMessage({ id: 'coordinator.taskList.filter.running' })}
              </SelectItem>
              <SelectItem value="completed">
                {formatMessage({ id: 'coordinator.taskList.filter.completed' })}
              </SelectItem>
              <SelectItem value="failed">
                {formatMessage({ id: 'coordinator.taskList.filter.failed' })}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sort Select */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger className="w-[120px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="time">
                {formatMessage({ id: 'coordinator.taskList.sort.time' })}
              </SelectItem>
              <SelectItem value="name">
                {formatMessage({ id: 'coordinator.taskList.sort.name' })}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Task Cards - Horizontal Scroll */}
      {filteredTasks.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          {filteredTasks.map((task) => (
            <CoordinatorTaskCard
              key={task.id}
              task={task}
              isSelected={task.id === selectedTaskId}
              onClick={() => onTaskSelect(task.id)}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Inbox className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-sm">
            {formatMessage({ id: 'coordinator.taskList.empty' })}
          </p>
        </div>
      )}
    </div>
  );
}

export default CoordinatorTaskList;
