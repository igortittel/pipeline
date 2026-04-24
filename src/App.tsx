import { useState, useEffect } from 'react';
import { Auth, useAuth } from './components/Auth';
import { Sidebar } from './components/Sidebar';
import { PipelineView } from './components/PipelineView';
import { TaskDrawer } from './components/TaskDrawer';
import { useAppStore } from './store';
import type { Task } from './types';
import { Layers } from 'lucide-react';

export default function App() {
  const [authenticated, setAuthenticated] = useState(useAuth);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const store = useAppStore();

  // Keep selectedTask in sync with store updates
  useEffect(() => {
    if (selectedTask && store.activePipeline) {
      const updated = store.activePipeline.tasks.find(t => t.id === selectedTask.id);
      if (updated) setSelectedTask(updated);
      else setSelectedTask(null);
    }
  }, [store.activePipeline]);

  if (!authenticated) {
    return <Auth onAuthenticated={() => setAuthenticated(true)} />;
  }

  return (
    <div className="flex h-screen bg-[#0f0f0f] overflow-hidden">
      <Sidebar
        pipelines={store.state.pipelines}
        activePipelineId={store.state.activePipelineId}
        onSelect={store.setActivePipeline}
        onCreate={store.createPipeline}
        onRename={store.renamePipeline}
        onDelete={store.deletePipeline}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {store.activePipeline ? (
          <PipelineView
            pipeline={store.activePipeline}
            onCreateTask={store.createTask}
            onTaskClick={setSelectedTask}
            onReorder={store.reorderTasks}
          />
        ) : (
          <EmptyState onCreatePipeline={() => store.createPipeline('My Pipeline')} />
        )}
      </main>

      <TaskDrawer
        task={selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={store.updateTask}
        onDelete={id => { store.deleteTask(id); setSelectedTask(null); }}
        onAddComment={store.addComment}
      />
    </div>
  );
}

function EmptyState({ onCreatePipeline }: { onCreatePipeline: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
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
  );
}
