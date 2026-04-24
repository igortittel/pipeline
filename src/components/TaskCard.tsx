import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { GripVertical, Calendar, User, MessageSquare, AlertCircle, ArrowUp, ArrowRight, ArrowDown, Minus } from 'lucide-react';
import type { Task } from '../types';

interface TaskCardProps {
  task: Task;
  onClick: () => void;
}

const priorityConfig = {
  urgent: { icon: AlertCircle, color: 'text-red-400', label: 'Urgent' },
  high: { icon: ArrowUp, color: 'text-orange-400', label: 'High' },
  medium: { icon: ArrowRight, color: 'text-yellow-400', label: 'Medium' },
  low: { icon: ArrowDown, color: 'text-[#555]', label: 'Low' },
};

const statusConfig = {
  backlog: { color: 'bg-[#333] text-[#888]', label: 'Backlog' },
  todo: { color: 'bg-[#1e3a5f] text-blue-300', label: 'Todo' },
  'in-progress': { color: 'bg-[#2d1f5e] text-purple-300', label: 'In Progress' },
  review: { color: 'bg-[#3a2d00] text-yellow-300', label: 'Review' },
  done: { color: 'bg-[#1a3a2a] text-green-300', label: 'Done' },
};

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

  const priority = priorityConfig[task.priority];
  const status = statusConfig[task.status];
  const PriorityIcon = priority.icon;

  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';

  return (
    <div ref={setNodeRef} style={style}>
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.15 }}
        onClick={onClick}
        className="group relative bg-[#141414] border border-[#1e1e1e] hover:border-[#2a2a2a] rounded-xl p-4 cursor-pointer transition-all hover:bg-[#161616]"
      >
        <div className="flex items-start gap-3">
          <button
            {...attributes}
            {...listeners}
            onClick={e => e.stopPropagation()}
            className="mt-0.5 text-[#333] hover:text-[#666] cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          >
            <GripVertical size={14} />
          </button>

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
  const priority = priorityConfig[task.priority];
  const PriorityIcon = priority.icon;

  return (
    <div className="bg-[#141414] border border-[#333] rounded-xl p-4 shadow-2xl rotate-1 w-full">
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
