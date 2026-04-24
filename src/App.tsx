import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Layers } from 'lucide-react';
import { Auth, useAuth, PASSWORD_KEY } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import { PipelineView } from './components/PipelineView';
import { TaskDrawer } from './components/TaskDrawer';
import { useAppStore } from './store';
import type { Task } from './types';

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="fixed inset-0 bg-[#0f0f0f] flex items-center justify-center z-[200]"
    >
      <button
        onClick={onDismiss}
        className="absolute top-5 right-5 text-[#555] hover:text-white transition-colors"
        aria-label="Skip"
      >
        <X size={18} />
      </button>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.15 }}
        className="text-white text-lg font-medium text-center max-w-sm px-8 leading-relaxed"
      >
        {message}
      </motion.p>
    </motion.div>
  );
}

export default function App() {
  const [authenticated, setAuthenticated] = useState(useAuth);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const store = useAppStore();

  function handleAuthenticated() {
    // Both state updates are batched into one render by React 18,
    // so the greeting overlay appears the same frame Auth disappears.
    const quote = GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
    setAuthenticated(true);
    setGreeting(quote);
  }

  function handleLogout() {
    localStorage.removeItem(PASSWORD_KEY);
    setAuthenticated(false);
    setGreeting(null);
  }

  useEffect(() => {
    if (selectedTask && store.activePipeline) {
      const updated = store.activePipeline.tasks.find(t => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
      else setSelectedTask(null);
    }
  }, [store.activePipeline]);

  if (!authenticated) {
    return <Auth onAuthenticated={handleAuthenticated} />;
  }

  const pipelineId = store.state.activePipelineId ?? '';

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
            <div
              className="fixed inset-0 bg-black/60 z-30 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
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
              />
            ) : (
              <EmptyState
                onMenuClick={() => setSidebarOpen(true)}
                onCreatePipeline={() => store.createPipeline('My Pipeline')}
              />
            )}
          </main>

          <TaskDrawer
            task={selectedTask}
            onClose={() => setSelectedTask(null)}
            onUpdate={(id, patch) => store.updateTask(id, patch, pipelineId)}
            onDelete={id => { store.deleteTask(id, pipelineId); setSelectedTask(null); }}
            onAddComment={(taskId, author, body) => store.addComment(taskId, author, body, pipelineId)}
          />
        </div>
      )}

      {/* Greeting overlay renders on top of everything, including the loading spinner */}
      <AnimatePresence>
        {greeting && (
          <GreetingOverlay message={greeting} onDismiss={() => setGreeting(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

function EmptyState({
  onCreatePipeline,
  onMenuClick,
}: {
  onCreatePipeline: () => void;
  onMenuClick: () => void;
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="flex items-center px-4 py-3 md:hidden border-b border-[#1e1e1e]">
        <button
          onClick={onMenuClick}
          className="text-[#555] hover:text-white transition-colors p-1.5 rounded-lg hover:bg-[#1e1e1e]"
          aria-label="Open menu"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
        <div className="w-12 h-12 rounded-2xl bg-[#161616] border border-[#2a2a2a] flex items-center justify-center mb-4">
          <Layers size={20} className="text-[#555]" />
        </div>
        <h2 className="text-white font-medium mb-2">No pipeline selected</h2>
        <p className="text-[#555] text-sm mb-6">Create a pipeline from the sidebar to get started</p>
        <button
          onClick={onCreatePipeline}
          className="text-sm text-white bg-[#1a1a1a] border border-[#2a2a2a] hover:border-[#3a3a3a] rounded-xl px-4 py-2.5 transition-all hover:bg-[#1e1e1e]"
        >
          Create first pipeline
        </button>
      </div>
    </div>
  );
}
