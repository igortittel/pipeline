import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Inbox } from 'lucide-react';
import type { Pipeline, Task, Status, Priority } from '../types';
import { TaskCard, TaskCardOverlay } from './TaskCard';

interface PipelineViewProps {
  pipeline: Pipeline;
  onMenuClick: () => void;
  onCreateTask: (title: string) => void;
  onTaskClick: (task: Task) => void;
  onReorder: (orderedIds: string[]) => void;
}

const ALL_STATUSES: Status[] = ['Nový', 'Pracujem na tom', 'Na kontrole', 'Hotovo'];
const ALL_PRIORITIES: Priority[] = ['low', 'medium', 'high'];
const ALL_ASSIGNEES = ['Dávid', 'Igor', 'Stano'];

const priorityLabels: Record<Priority, string> = { low: 'Low', medium: 'Medium', high: 'High' };

const filterSelect = 'bg-[#141414] border border-[#222] text-[#666] rounded-lg px-2.5 py-1 text-xs outline-none hover:border-[#333] hover:text-[#aaa] transition-colors [color-scheme:dark] cursor-pointer';

export function PipelineView({ pipeline, onMenuClick, onCreateTask, onTaskClick, onReorder }: PipelineViewProps) {
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');

  const dragConstraint = { delay: 250, tolerance: 5 };
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: dragConstraint }),
    useSensor(TouchSensor,   { activationConstraint: dragConstraint }),
  );

  const sortedTasks = [...pipeline.tasks].sort((a, b) => a.order - b.order);
  const activeTask = activeId ? sortedTasks.find(t => t.id === activeId) : null;

  const filteredTasks = sortedTasks.filter(task => {
    if (filterStatus && task.status !== filterStatus) return false;
    if (filterPriority && task.priority !== filterPriority) return false;
    if (filterAssignee && task.assignee !== filterAssignee) return false;
    return true;
  });

  const hasActiveFilters = filterStatus || filterPriority || filterAssignee;

  function handleDragStart(event: { active: { id: string | number } }) {
    setActiveId(String(event.active.id));
    document.body.classList.add('is-dragging');
    // Haptic pulse on drag activation (supported on Android; no-op elsewhere)
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(30);
    }
  }

  function cleanupDrag() {
    setActiveId(null);
    document.body.classList.remove('is-dragging');
  }

  function handleDragEnd(event: DragEndEvent) {
    cleanupDrag();
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedTasks.findIndex(t => t.id === active.id);
    const newIndex = sortedTasks.findIndex(t => t.id === over.id);
    const reordered = arrayMove(sortedTasks, oldIndex, newIndex);
    onReorder(reordered.map(t => t.id));
  }

  function handleDragCancel() {
    cleanupDrag();
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const title = newTitle.trim();
    if (title) {
      onCreateTask(title);
      setNewTitle('');
      setAdding(false);
    }
  }

  return (
    <div className="flex-1 h-full overflow-y-auto">
      <div className="max-w-[800px] mx-auto px-3 sm:px-6 py-4 sm:py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-4 sm:mb-5">
          <div className="flex items-center gap-3 min-w-0">
            {/* Hamburger — mobile only */}
            <button
              onClick={onMenuClick}
              className="md:hidden flex-shrink-0 text-[#555] hover:text-white transition-colors p-1.5 rounded-lg hover:bg-[#1e1e1e]"
              aria-label="Open menu"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold text-white tracking-tight truncate">{pipeline.name}</h1>
              <p className="text-xs text-[#555] mt-0.5">
                {pipeline.tasks.length} task{pipeline.tasks.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-[#666] hover:text-white border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 transition-all hover:bg-[#161616] flex-shrink-0"
          >
            <Plus size={13} />
            <span className="hidden xs:inline">Add task</span>
            <span className="xs:hidden">Add</span>
          </button>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className={filterSelect}
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className={filterSelect}
          >
            <option value="">All priorities</option>
            {ALL_PRIORITIES.map(p => <option key={p} value={p}>{priorityLabels[p]}</option>)}
          </select>
          <select
            value={filterAssignee}
            onChange={e => setFilterAssignee(e.target.value)}
            className={filterSelect}
          >
            <option value="">All assignees</option>
            {ALL_ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
          {hasActiveFilters && (
            <button
              onClick={() => { setFilterStatus(''); setFilterPriority(''); setFilterAssignee(''); }}
              className="text-xs text-[#555] hover:text-[#888] transition-colors px-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* New task input */}
        <AnimatePresence>
          {adding && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              onSubmit={handleCreate}
              className="mb-3 overflow-hidden"
            >
              <input
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onBlur={() => { if (!newTitle.trim()) setAdding(false); }}
                onKeyDown={e => e.key === 'Escape' && setAdding(false)}
                placeholder="Task title..."
                autoFocus
                className="w-full bg-[#141414] border border-[#2a2a2a] focus:border-[#3a3a3a] rounded-xl px-4 py-3 text-sm text-white placeholder-[#444] outline-none transition-all"
              />
            </motion.form>
          )}
        </AnimatePresence>

        {/* Task list */}
        {sortedTasks.length === 0 && !adding ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-16 sm:py-24 text-center"
          >
            <Inbox size={32} className="text-[#333] mb-4" />
            <p className="text-[#444] text-sm">No tasks yet</p>
            <button
              onClick={() => setAdding(true)}
              className="mt-4 text-xs text-[#555] hover:text-[#888] transition-colors underline underline-offset-2"
            >
              Create your first task
            </button>
          </motion.div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                <AnimatePresence>
                  {filteredTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                    />
                  ))}
                </AnimatePresence>
                {filteredTasks.length === 0 && sortedTasks.length > 0 && (
                  <p className="text-center text-[#444] text-sm py-8">No tasks match the current filters</p>
                )}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeTask && (
                <motion.div
                  initial={{ scale: 1, rotate: 0 }}
                  animate={{ scale: 1.04, rotate: 1 }}
                  transition={{ duration: 0.15, ease: 'easeOut' }}
                >
                  <TaskCardOverlay task={activeTask} />
                </motion.div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
