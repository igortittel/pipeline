import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus, Inbox } from 'lucide-react';
import type { Pipeline, Task } from '../types';
import { TaskCard, TaskCardOverlay } from './TaskCard';

interface PipelineViewProps {
  pipeline: Pipeline;
  onMenuClick: () => void;
  onCreateTask: (title: string) => void;
  onTaskClick: (task: Task) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function PipelineView({ pipeline, onMenuClick, onCreateTask, onTaskClick, onReorder }: PipelineViewProps) {
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const sortedTasks = [...pipeline.tasks].sort((a, b) => a.order - b.order);
  const activeTask = activeId ? sortedTasks.find(t => t.id === activeId) : null;

  function handleDragStart(event: { active: { id: string | number } }) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sortedTasks.findIndex(t => t.id === active.id);
    const newIndex = sortedTasks.findIndex(t => t.id === over.id);
    const reordered = arrayMove(sortedTasks, oldIndex, newIndex);
    onReorder(reordered.map(t => t.id));
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
        <div className="flex items-center justify-between mb-5 sm:mb-6">
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
          >
            <SortableContext items={sortedTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                <AnimatePresence>
                  {sortedTasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task)}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </SortableContext>

            <DragOverlay>
              {activeTask && <TaskCardOverlay task={activeTask} />}
            </DragOverlay>
          </DndContext>
        )}
      </div>
    </div>
  );
}
