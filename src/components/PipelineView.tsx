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
  onCreateTask: (title: string) => void;
  onTaskClick: (task: Task) => void;
  onReorder: (orderedIds: string[]) => void;
}

export function PipelineView({ pipeline, onCreateTask, onTaskClick, onReorder }: PipelineViewProps) {
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
      <div className="max-w-[800px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-white tracking-tight">{pipeline.name}</h1>
            <p className="text-xs text-[#555] mt-0.5">
              {pipeline.tasks.length} task{pipeline.tasks.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-2 text-sm text-[#666] hover:text-white border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-xl px-3 py-2 transition-all hover:bg-[#161616]"
          >
            <Plus size={14} />
            Add task
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
            className="flex flex-col items-center justify-center py-24 text-center"
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
