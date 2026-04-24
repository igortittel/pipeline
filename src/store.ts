import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase';
import type { AppState, Pipeline, Task, Comment, Priority, Status } from './types';

const ACTIVE_KEY = 'pp-active-pipeline';

type DbPipeline = { id: string; name: string; created_at: string };
type DbTask = {
  id: string; pipeline_id: string; title: string; description: string;
  status: string; priority: string; order_index: number; assignee: string;
  deadline: string; asset_links: string[]; created_at: string;
};
type DbComment = { id: string; task_id: string; author: string; body: string; created_at: string };

function buildPipelines(
  dbPipelines: DbPipeline[],
  dbTasks: DbTask[],
  dbComments: DbComment[],
): Pipeline[] {
  const commentsByTask = new Map<string, Comment[]>();
  for (const c of dbComments) {
    const arr = commentsByTask.get(c.task_id) ?? [];
    arr.push({ id: c.id, author: c.author, body: c.body, createdAt: c.created_at });
    commentsByTask.set(c.task_id, arr);
  }

  const tasksByPipeline = new Map<string, Task[]>();
  for (const t of dbTasks) {
    const arr = tasksByPipeline.get(t.pipeline_id) ?? [];
    arr.push({
      id: t.id, title: t.title, description: t.description,
      status: t.status as Status, priority: t.priority as Priority,
      order: t.order_index, assignee: t.assignee, deadline: t.deadline,
      assetLinks: t.asset_links, createdAt: t.created_at,
      comments: commentsByTask.get(t.id) ?? [],
    });
    tasksByPipeline.set(t.pipeline_id, arr);
  }

  return dbPipelines.map(p => ({
    id: p.id, name: p.name, createdAt: p.created_at,
    tasks: (tasksByPipeline.get(p.id) ?? []).sort((a, b) => a.order - b.order),
  }));
}

export function useAppStore() {
  const [state, setState] = useState<AppState>({
    pipelines: [],
    activePipelineId: localStorage.getItem(ACTIVE_KEY),
  });
  const [loading, setLoading] = useState(true);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAll = useCallback(async () => {
    const [{ data: dbPipelines }, { data: dbTasks }, { data: dbComments }] = await Promise.all([
      supabase.from('pipelines').select('*').order('created_at'),
      supabase.from('tasks').select('*').order('order_index'),
      supabase.from('comments').select('*').order('created_at'),
    ]);

    const pipelines = buildPipelines(
      (dbPipelines as DbPipeline[]) ?? [],
      (dbTasks as DbTask[]) ?? [],
      (dbComments as DbComment[]) ?? [],
    );

    setState(prev => {
      const activeStillExists = pipelines.some(p => p.id === prev.activePipelineId);
      const activePipelineId = activeStillExists
        ? prev.activePipelineId
        : (pipelines[0]?.id ?? null);
      return { pipelines, activePipelineId };
    });
  }, []);

  // Debounced version for realtime events to avoid stampede on bulk ops like reorder
  const scheduleFetch = useCallback(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(fetchAll, 150);
  }, [fetchAll]);

  useEffect(() => {
    fetchAll().finally(() => setLoading(false));

    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipelines' }, scheduleFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, scheduleFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, scheduleFetch)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    };
  }, [fetchAll, scheduleFetch]);

  const activePipeline = state.pipelines.find(p => p.id === state.activePipelineId) ?? null;

  const setActivePipeline = useCallback((id: string) => {
    localStorage.setItem(ACTIVE_KEY, id);
    setState(prev => ({ ...prev, activePipelineId: id }));
  }, []);

  const createPipeline = useCallback(async (name: string) => {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    setState(prev => ({
      ...prev,
      pipelines: [...prev.pipelines, { id, name, tasks: [], createdAt }],
      activePipelineId: id,
    }));
    localStorage.setItem(ACTIVE_KEY, id);
    await supabase.from('pipelines').insert({ id, name });
  }, []);

  const renamePipeline = useCallback(async (id: string, name: string) => {
    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p => p.id === id ? { ...p, name } : p),
    }));
    await supabase.from('pipelines').update({ name }).eq('id', id);
  }, []);

  const deletePipeline = useCallback(async (id: string) => {
    setState(prev => {
      const pipelines = prev.pipelines.filter(p => p.id !== id);
      const activePipelineId = prev.activePipelineId === id
        ? (pipelines[0]?.id ?? null)
        : prev.activePipelineId;
      if (activePipelineId) localStorage.setItem(ACTIVE_KEY, activePipelineId);
      else localStorage.removeItem(ACTIVE_KEY);
      return { ...prev, pipelines, activePipelineId };
    });
    await supabase.from('pipelines').delete().eq('id', id);
  }, []);

  const createTask = useCallback(async (title: string, pipelineId: string) => {
    const pipeline = state.pipelines.find(p => p.id === pipelineId);
    if (!pipeline) return;

    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const orderIndex = pipeline.tasks.reduce((m, t) => Math.max(m, t.order), -1) + 1;

    const task: Task = {
      id, title, description: '', status: 'Nový', priority: 'medium',
      assignee: '', deadline: '', assetLinks: [], comments: [],
      createdAt, order: orderIndex,
    };

    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p =>
        p.id === pipelineId ? { ...p, tasks: [...p.tasks, task] } : p,
      ),
    }));

    await supabase.from('tasks').insert({
      id, pipeline_id: pipelineId, title, description: '',
      status: 'Nový', priority: 'medium', assignee: '', deadline: '',
      asset_links: [], order_index: orderIndex,
    });
  }, [state.pipelines]);

  const updateTask = useCallback(async (taskId: string, patch: Partial<Task>, pipelineId: string) => {
    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p =>
        p.id === pipelineId
          ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, ...patch } : t) }
          : p,
      ),
    }));

    const dbPatch: Record<string, unknown> = {};
    if (patch.title !== undefined)       dbPatch.title       = patch.title;
    if (patch.description !== undefined) dbPatch.description = patch.description;
    if (patch.status !== undefined)      dbPatch.status      = patch.status;
    if (patch.priority !== undefined)    dbPatch.priority    = patch.priority;
    if (patch.assignee !== undefined)    dbPatch.assignee    = patch.assignee;
    if (patch.deadline !== undefined)    dbPatch.deadline    = patch.deadline;
    if (patch.assetLinks !== undefined)  dbPatch.asset_links = patch.assetLinks;
    if (patch.order !== undefined)       dbPatch.order_index = patch.order;

    if (Object.keys(dbPatch).length > 0) {
      await supabase.from('tasks').update(dbPatch).eq('id', taskId);
    }
  }, []);

  const deleteTask = useCallback(async (taskId: string, pipelineId: string) => {
    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p =>
        p.id === pipelineId
          ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) }
          : p,
      ),
    }));
    await supabase.from('tasks').delete().eq('id', taskId);
  }, []);

  const reorderTasks = useCallback(async (orderedIds: string[], pipelineId: string) => {
    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p => {
        if (p.id !== pipelineId) return p;
        const taskMap = new Map(p.tasks.map(t => [t.id, t]));
        const tasks = orderedIds
          .map((id, index) => { const t = taskMap.get(id); return t ? { ...t, order: index } : null; })
          .filter(Boolean) as Task[];
        return { ...p, tasks };
      }),
    }));

    await Promise.all(
      orderedIds.map((id, index) =>
        supabase.from('tasks').update({ order_index: index }).eq('id', id),
      ),
    );
  }, []);

  const addComment = useCallback(async (taskId: string, author: string, body: string, pipelineId: string) => {
    const id = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const comment: Comment = { id, author, body, createdAt };

    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p =>
        p.id === pipelineId
          ? {
              ...p,
              tasks: p.tasks.map(t =>
                t.id === taskId ? { ...t, comments: [...t.comments, comment] } : t,
              ),
            }
          : p,
      ),
    }));

    await supabase.from('comments').insert({ id, task_id: taskId, author, body });
  }, []);

  return {
    state,
    loading,
    activePipeline,
    setActivePipeline,
    createPipeline,
    renamePipeline,
    deletePipeline,
    createTask,
    updateTask,
    deleteTask,
    reorderTasks,
    addComment,
  };
}
