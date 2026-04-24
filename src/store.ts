import { useState, useCallback } from 'react';
import type { AppState, Pipeline, Task } from './types';

const STORAGE_KEY = 'product-pipeline-data';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { pipelines: [], activePipelineId: null };
}

function saveState(state: AppState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function useAppStore() {
  const [state, setState] = useState<AppState>(loadState);

  const update = useCallback((updater: (s: AppState) => AppState) => {
    setState(prev => {
      const next = updater(prev);
      saveState(next);
      return next;
    });
  }, []);

  const activePipeline = state.pipelines.find(p => p.id === state.activePipelineId) ?? null;

  const createPipeline = useCallback((name: string) => {
    const pipeline: Pipeline = {
      id: generateId(),
      name,
      tasks: [],
      createdAt: new Date().toISOString(),
    };
    update(s => ({
      ...s,
      pipelines: [...s.pipelines, pipeline],
      activePipelineId: pipeline.id,
    }));
  }, [update]);

  const renamePipeline = useCallback((id: string, name: string) => {
    update(s => ({
      ...s,
      pipelines: s.pipelines.map(p => p.id === id ? { ...p, name } : p),
    }));
  }, [update]);

  const deletePipeline = useCallback((id: string) => {
    update(s => {
      const pipelines = s.pipelines.filter(p => p.id !== id);
      const activePipelineId = s.activePipelineId === id
        ? (pipelines[0]?.id ?? null)
        : s.activePipelineId;
      return { ...s, pipelines, activePipelineId };
    });
  }, [update]);

  const setActivePipeline = useCallback((id: string) => {
    update(s => ({ ...s, activePipelineId: id }));
  }, [update]);

  const createTask = useCallback((title: string) => {
    if (!state.activePipelineId) return;
    const pipelineId = state.activePipelineId;
    update(s => {
      const pipeline = s.pipelines.find(p => p.id === pipelineId);
      if (!pipeline) return s;
      const maxOrder = pipeline.tasks.reduce((m, t) => Math.max(m, t.order), -1);
      const task: Task = {
        id: generateId(),
        title,
        description: '',
        status: 'todo',
        priority: 'medium',
        assignee: '',
        deadline: '',
        assetLinks: [],
        comments: [],
        createdAt: new Date().toISOString(),
        order: maxOrder + 1,
      };
      return {
        ...s,
        pipelines: s.pipelines.map(p =>
          p.id === pipelineId ? { ...p, tasks: [...p.tasks, task] } : p
        ),
      };
    });
  }, [state.activePipelineId, update]);

  const updateTask = useCallback((taskId: string, patch: Partial<Task>) => {
    if (!state.activePipelineId) return;
    const pipelineId = state.activePipelineId;
    update(s => ({
      ...s,
      pipelines: s.pipelines.map(p =>
        p.id === pipelineId
          ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, ...patch } : t) }
          : p
      ),
    }));
  }, [state.activePipelineId, update]);

  const deleteTask = useCallback((taskId: string) => {
    if (!state.activePipelineId) return;
    const pipelineId = state.activePipelineId;
    update(s => ({
      ...s,
      pipelines: s.pipelines.map(p =>
        p.id === pipelineId
          ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) }
          : p
      ),
    }));
  }, [state.activePipelineId, update]);

  const reorderTasks = useCallback((orderedIds: string[]) => {
    if (!state.activePipelineId) return;
    const pipelineId = state.activePipelineId;
    update(s => ({
      ...s,
      pipelines: s.pipelines.map(p => {
        if (p.id !== pipelineId) return p;
        const taskMap = new Map(p.tasks.map(t => [t.id, t]));
        const tasks = orderedIds
          .map((id, index) => {
            const t = taskMap.get(id);
            return t ? { ...t, order: index } : null;
          })
          .filter(Boolean) as Task[];
        return { ...p, tasks };
      }),
    }));
  }, [state.activePipelineId, update]);

  const addComment = useCallback((taskId: string, author: string, body: string) => {
    if (!state.activePipelineId) return;
    const pipelineId = state.activePipelineId;
    update(s => ({
      ...s,
      pipelines: s.pipelines.map(p =>
        p.id === pipelineId
          ? {
              ...p,
              tasks: p.tasks.map(t =>
                t.id === taskId
                  ? {
                      ...t,
                      comments: [...t.comments, {
                        id: generateId(),
                        author,
                        body,
                        createdAt: new Date().toISOString(),
                      }],
                    }
                  : t
              ),
            }
          : p
      ),
    }));
  }, [state.activePipelineId, update]);

  return {
    state,
    activePipeline,
    createPipeline,
    renamePipeline,
    deletePipeline,
    setActivePipeline,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    addComment,
  };
}
