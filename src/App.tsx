import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers } from 'lucide-react';
import { Auth, useAuth, PASSWORD_KEY } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import { PipelineView } from './components/PipelineView';
import { TaskDrawer } from './components/TaskDrawer';
import { NotificationCenter } from './components/NotificationCenter';
import { useAppStore } from './store';
import type { Task, Notification, Pipeline } from './types';

const GREETINGS = [
  "Kanospace načítaný. Skús dnes nepokaziť produkciu.",
  "Vitaj. Poďme konečne spraviť nejakú robotu",
  "Tento text je úplne zbytočný",
  "Stano pozýva na pivo",
  "Jak sa hovorí, Jebem na to neska už",
];

function GreetingOverlay({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    const timer = setTimeout(() => onDismissRef.current(), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center z-[200]">
      <button onClick={onDismiss} className="absolute top-5 right-5 text-[#555] hover:text-white transition-colors" aria-label="Skip">
        <X size={18} />
      </button>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15 }}
        className="text-white text-lg font-medium text-center max-w-sm px-8 leading-relaxed">
        {message}
      </motion.p>
    </motion.div>
  );
}

// Detects changes between two pipeline snapshots and emits notifications
function detectNotifications(prev: Pipeline[], next: Pipeline[]): Notification[] {
  const notifs: Notification[] = [];

  for (const pipeline of next) {
    const prevPipeline = prev.find(p => p.id === pipeline.id);

    for (const task of pipeline.tasks) {
      if (task.archived) continue;
      const prevTask = prevPipeline?.tasks.find(t => t.id === task.id);

      // Initial load — check for tasks due today or tomorrow
      if (!prevTask) {
        if (task.deadline) {
          const daysUntil = Math.ceil((new Date(task.deadline).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86400000);
          if (daysUntil === 0 || daysUntil === 1) {
            notifs.push({
              id: crypto.randomUUID(), type: 'deadline',
              taskId: task.id, taskTitle: task.title, pipelineId: pipeline.id,
              message: daysUntil === 0 ? 'Deadline je dnes' : 'Deadline je zajtra',
              createdAt: new Date().toISOString(), read: false,
            });
          }
        }
        continue;
      }

      // Status changed
      if (prevTask.status !== task.status) {
        notifs.push({
          id: crypto.randomUUID(), type: 'status',
          taskId: task.id, taskTitle: task.title, pipelineId: pipeline.id,
          message: `${prevTask.status} → ${task.status}`,
          createdAt: new Date().toISOString(), read: false,
        });
      }

      // New comment added
      if (task.comments.length > prevTask.comments.length) {
        const c = task.comments[task.comments.length - 1];
        notifs.push({
          id: crypto.randomUUID(), type: 'comment',
          taskId: task.id, taskTitle: task.title, pipelineId: pipeline.id,
          message: `${c.author}: ${c.body.slice(0, 60)}${c.body.length > 60 ? '…' : ''}`,
          createdAt: new Date().toISOString(), read: false,
        });
      }
    }
  }

  return notifs;
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(useAuth);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const prevPipelinesRef = useRef<Pipeline[]>([]);
  const initialTaskIdRef = useRef(new URLSearchParams(window.location.search).get('task'));
  const store = useAppStore();

  // Detect changes and generate notifications
  useEffect(() => {
    const prev = prevPipelinesRef.current;
    if (store.state.pipelines.length === 0) return;

    const newNotifs = detectNotifications(prev, store.state.pipelines);
    if (newNotifs.length > 0) {
      setNotifications(n => [...newNotifs, ...n].slice(0, 50)); // cap at 50
    }

    prevPipelinesRef.current = store.state.pipelines;
  }, [store.state.pipelines]);

  // Keep selectedTask in sync with store updates
  useEffect(() => {
    if (selectedTask && store.activePipeline) {
      const updated = store.activePipeline.tasks.find(t => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
      else setSelectedTask(null);
    }
  }, [store.activePipeline]);

  // Deep link: open task from ?task=<id> in URL after data loads
  useEffect(() => {
    if (store.loading || !initialTaskIdRef.current) return;
    const taskId = initialTaskIdRef.current;
    initialTaskIdRef.current = null;
    for (const pipeline of store.state.pipelines) {
      const task = pipeline.tasks.find(t => t.id === taskId);
      if (task) {
        store.setActivePipeline(pipeline.id);
        setSelectedTask(task);
        break;
      }
    }
  }, [store.loading]);

  // Sync URL with open task
  useEffect(() => {
    const url = new URL(window.location.href);
    if (selectedTask) url.searchParams.set('task', selectedTask.id);
    else url.searchParams.delete('task');
    window.history.replaceState({}, '', url.toString());
  }, [selectedTask]);

  function handleAuthenticated() {
    const quote = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    setAuthenticated(true);
    setGreeting(quote);
  }

  function handleLogout() {
    localStorage.removeItem(PASSWORD_KEY);
    setAuthenticated(false);
    setGreeting(null);
    setNotifications([]);
    prevPipelinesRef.current = [];
  }

  function handleOpenTask(taskId: string, pipelineId: string) {
    store.setActivePipeline(pipelineId);
    const pipeline = store.state.pipelines.find(p => p.id === pipelineId);
    const task = pipeline?.tasks.find(t => t.id === taskId);
    if (task) setSelectedTask(task);
  }

  // Auto-dismiss Supabase write errors after 6s
  useEffect(() => {
    if (!store.lastError) return;
    const t = setTimeout(store.clearError, 6000);
    return () => clearTimeout(t);
  }, [store.lastError, store.clearError]);

  if (!authenticated) {
    return <Auth onAuthenticated={handleAuthenticated} />;
  }

  const pipelineId = store.state.activePipelineId ?? '';

  const notificationBell = (
    <NotificationCenter
      notifications={notifications}
      onDismiss={id => setNotifications(n => n.filter(x => x.id !== id))}
      onDismissAll={() => setNotifications([])}
      onOpenTask={handleOpenTask}
    />
  );

  return (
    <>
      {store.loading ? (
        <div className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-5 h-5 border-2 border-[#333] border-t-[#666] rounded-full animate-spin" />
            <span className="text-[#444] text-xs">Loading…</span>
          </div>
        </div>
      ) : (
        <div className="flex h-screen bg-[#0f0f0f] overflow-hidden">
          {sidebarOpen && (
            <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
          )}

          <Sidebar
            pipelines={store.state.pipelines}
            activePipelineId={store.state.activePipelineId}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            onSelect={id => { store.setActivePipeline(id); setSidebarOpen(false); }}
            onCreate={store.createPipeline}
            onRename={store.renamePipeline}
            onDelete={store.deletePipeline}
            onLogout={handleLogout}
          />

          <main className="flex-1 flex flex-col overflow-hidden min-w-0">
            {store.activePipeline ? (
              <PipelineView
                pipeline={store.activePipeline}
                onMenuClick={() => setSidebarOpen(true)}
                onCreateTask={title => store.createTask(title, pipelineId)}
                onTaskClick={setSelectedTask}
                onReorder={ids => store.reorderTasks(ids, pipelineId)}
                onArchive={id => store.archiveTask(id, pipelineId)}
                notificationBell={notificationBell}
              />
            ) : (
              <EmptyState
                onMenuClick={() => setSidebarOpen(true)}
                onCreatePipeline={() => store.createPipeline('My Pipeline')}
                notificationBell={notificationBell}
              />
            )}
          </main>

          <TaskDrawer
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={(id, patch) => store.updateTask(id, patch, pipelineId)}
            onDelete={id => { store.deleteTask(id, pipelineId); setSelectedTask(null); }}
            onAddComment={(taskId, author, body) => store.addComment(taskId, author, body, pipelineId)}
            onUpdateComment={(taskId, commentId, patch) => store.updateComment(taskId, commentId, patch, pipelineId)}
            onDeleteComment={(taskId, commentId) => store.deleteComment(taskId, commentId, pipelineId)}
            onUploadFile={(taskId, file) => store.uploadFile(taskId, file, pipelineId)}
            onDeleteFile={(taskId, fileId, url) => store.deleteFile(taskId, fileId, url, pipelineId)}
          />
        </div>
      )}

      <AnimatePresence>
        {greeting && <GreetingOverlay message={greeting} onDismiss={() => setGreeting(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {store.lastError && (
          <motion.div
            key="error-toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[300] flex items-center gap-3 bg-[#1a0a0a] border border-red-900/60 text-red-300 text-xs px-4 py-3 rounded-xl shadow-xl max-w-sm w-[calc(100vw-2rem)]"
          >
            <span className="flex-1 leading-relaxed">{store.lastError}</span>
            <button
              onClick={store.clearError}
              className="text-red-500 hover:text-red-300 transition-colors flex-shrink-0"
              aria-label="Zavrieť"
            >
              <X size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function EmptyState({
  onCreatePipeline, onMenuClick, notificationBell,
}: {
  onCreatePipeline: () => void;
  onMenuClick: () => void;
  notificationBell: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1e1e1e]">
        <button onClick={onMenuClick}
          className="md:hidden text-[#555] hover:text-white transition-colors p-1.5 rounded-lg hover:bg-[#1e1e1e]"
          aria-label="Open menu">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
        <div className="ml-auto">{notificationBell}</div>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-[#161616] border border-[#2a2a2a] flex items-center justify-center mb-4">
          <Layers size={20} className="text-[#555]" />
        </div>
        <h2 className="text-white font-medium mb-2">No pipeline selected</h2>
        <p className="text-[#555] text-sm mb-6">Create a pipeline from the sidebar to get started</p>
        <button onClick={onCreatePipeline}
          className="text-sm text-white bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-xl px-4 py-2.5 transition-all hover:bg-[#1e1e1e]">
          Create first pipeline
        </button>
      </div>
    </div>
  );
}
