import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, MessageSquare, ArrowRight, Calendar, CheckCircle } from 'lucide-react';
import type { Notification } from '../types';

interface NotificationCenterProps {
  notifications: Notification[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onOpenTask: (taskId: string, pipelineId: string) => void;
}

const typeIcon = {
  status: CheckCircle,
  comment: MessageSquare,
  deadline: Calendar,
};

const typeColor = {
  status: 'text-purple-400',
  comment: 'text-blue-400',
  deadline: 'text-orange-400',
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'práve teraz';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.floor(hrs / 24)}d`;
}

export function NotificationCenter({ notifications, onDismiss, onDismissAll, onOpenTask }: NotificationCenterProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const unread = notifications.filter(n => !n.read).length;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(o => !o)}
        className="relative text-[#555] hover:text-white transition-colors p-1.5 rounded-lg hover:bg-[#1e1e1e]"
        aria-label="Notifications"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-blue-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-8 w-80 bg-[#161616] border border-[#2a2a2a] rounded-xl shadow-2xl z-[100] overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#222]">
              <span className="text-xs font-medium text-[#888] uppercase tracking-wider">
                Notifikácie
              </span>
              {notifications.length > 0 && (
                <button
                  onClick={onDismissAll}
                  className="text-[10px] text-[#555] hover:text-[#888] transition-colors"
                >
                  Vymazať všetky
                </button>
              )}
            </div>

            {/* List */}
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center">
                  <Bell size={20} className="text-[#333] mx-auto mb-2" />
                  <p className="text-[#444] text-xs">Žiadne notifikácie</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {notifications.map(n => {
                    const Icon = typeIcon[n.type];
                    return (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.15 }}
                        className="border-b border-[#1e1e1e] last:border-0"
                      >
                        <div
                          onClick={() => {
                            onOpenTask(n.taskId, n.pipelineId);
                            setOpen(false);
                          }}
                          className="flex items-start gap-3 px-4 py-3 hover:bg-[#1e1e1e] cursor-pointer transition-colors group"
                        >
                          <Icon size={13} className={`flex-shrink-0 mt-0.5 ${typeColor[n.type]}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#aaa] leading-snug truncate font-medium">
                              {n.taskTitle}
                            </p>
                            <p className="text-[11px] text-[#555] mt-0.5 leading-snug">{n.message}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <span className="text-[10px] text-[#444]">{timeAgo(n.createdAt)}</span>
                            <button
                              onClick={e => { e.stopPropagation(); onDismiss(n.id); }}
                              className="opacity-0 group-hover:opacity-100 text-[#444] hover:text-white transition-all"
                            >
                              <X size={11} />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
