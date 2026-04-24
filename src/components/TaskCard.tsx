import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { GripVertical, Calendar, User, MessageSquare, ArrowUp, ArrowRight, ArrowDown } from 'lucide-react';
import type { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

const priorityConfig = {
  high: { icon: ArrowUp, color: 'text-orange-400', label: 'High' },
  medium: { icon: ArrowRight, color: 'text-yellow-400', label: 'Medium' },
  low: { icon: ArrowDown, color: 'text-[#555]', label: 'Low' },
};

const statusConfig = {
  'Nový': { color: 'bg-[#1e3a5f] text-blue-300', label: 'Nový' },
  'Pracujem na tom': { color: 'bg-[#2d1f5e] text-purple-300', label: 'Pracujem na tom' },
  'Na kontrole': { color: 'bg-[#3a2d00] text-yellow-300', label: 'Na kontrole' },
  'Hotovo': { color: 'bg-[#1a3a2a] text-green-300', label: 'Hotovo' },
};

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

export function TaskCard({ task, onClick }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  };

  const priority = priorityConfig[task.priority] ?? priorityConfig.medium;
  const status = statusConfig[task.status] ?? { color: 'bg-[#333] text-[#888]', label: task.status };
  const PriorityIcon = priority.icon;

  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'Hotovo';
  const isOnFire = task.status === 'Nový' && task.createdAt &&
    (Date.now() - new Date(task.createdAt).getTime()) > TWO_DAYS_MS;

  return (
    /*
     * Listeners live on the outermost div so the whole card surface is the
     * drag handle — essential for mobile where there's no hover state to
     * reveal the grip icon. The .task-draggable class suppresses browser
     * long-press text-selection and tap highlight.
     */
    <div
      ref={setNodeRef}
      style={style}
      className="task-draggable"
      {...attributes}
      {...listeners}
    >
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        onClick={onClick}
        className={`group relative bg-[#141414] border border-[#1e1e1e] hover:border-[#2a2a2a] rounded-xl p-4 cursor-pointer transition-all hover:bg-[#161616]${isOnFire ? ' on-fire' : ''}`}
      >
        <div className="flex items-start gap-3">
          {/* Grip — always visible on mobile (touch devices have no hover) */}
          <div className="mt-0.5 text-[#444] md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0 cursor-grab">
            <GripVertical size={14} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-sm text-white font-medium leading-snug">{task.title}</p>
              <PriorityIcon size={14} className={`flex-shrink-0 mt-0.5 ${priority.color}`} />
            </div>

            {task.description && (
              <p className="text-xs text-[#666] leading-relaxed mb-3 line-clamp-2">{task.description}</p>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.color}`}>
                {status.label}
              </span>

              {task.assignee && (
                <div className="flex items-center gap-1 text-[#555] text-xs">
                  <User size={11} />
                  <span>{task.assignee}</span>
                </div>
              )}

              {task.deadline && (
                <div className={`flex items-center gap-1 text-xs ${isOverdue ? 'text-red-400' : 'text-[#555]'}`}>
                  <Calendar size={11} />
                  <span>{new Date(task.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              )}

              {task.comments.length > 0 && (
                <div className="flex items-center gap-1 text-[#555] text-xs">
                  <MessageSquare size={11} />
                  <span>{task.comments.length}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function TaskCardOverlay({ task }: { task: Task }) {
  const priority = priorityConfig[task.priority] ?? priorityConfig.medium;
  const PriorityIcon = priority.icon;

  return (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 shadow-2xl w-full">
      <div className="flex items-start gap-3">
        <GripVertical size={14} className="mt-0.5 text-[#555] flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm text-white font-medium">{task.title}</p>
            <PriorityIcon size={14} className={`flex-shrink-0 mt-0.5 ${priority.color}`} />
          </div>
        </div>
      </div>
    </div>
  );
}
