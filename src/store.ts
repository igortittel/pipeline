import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from './lib/supabase';
import type { AppState, Pipeline, Task, TaskFile, Comment, Priority, Status } from './types';

const ACTIVE_KEY = 'pp-active-pipeline';
const ARCHIVED_KEY = 'pp-archived-v1';   // localStorage – DB nemá stĺpec archived (zatiaľ)
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

// ─── Local archive helpers (fallback kým DB nemá stĺpec archived) ───────────
function getLocalArchived(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(ARCHIVED_KEY) ?? '[]')); }
  catch { return new Set(); }
}
function setLocalArchived(ids: Set<string>) {
  localStorage.setItem(ARCHIVED_KEY, JSON.stringify([...ids]));
}
function toggleLocalArchived(taskId: string, archived: boolean) {
  const ids = getLocalArchived();
  if (archived) ids.add(taskId); else ids.delete(taskId);
  setLocalArchived(ids);
}

// ─── DB row types ─────────────────────────────────────────────────────────────
type DbPipeline = { id: string; name: string; created_at: string };
type DbTask = {
  id: string; pipeline_id: string; title: string; description: string;
  status: string; priority: string; order_index: number; assignee: string;
  deadline: string; asset_links: string[]; created_at: string;
  // completed_at and archived may not exist in DB yet – treated as optional
  completed_at?: string | null;
  archived?: boolean;
};
type DbComment = { id: string; task_id: string; author: string; body: string; created_at: string };
type DbFile   = { id: string; task_id: string; name: string; url: string; size: number; created_at: string };

const STATUS_MAP: Record<string, Status> = {
  backlog: 'Nový', todo: 'Nový',
  'in-progress': 'Pracujem na tom',
  review: 'Na kontrole',
  done: 'Hotovo',
};
const VALID_STATUSES  = new Set<string>(['Nový', 'Pracujem na tom', 'Na kontrole', 'Hotovo']);
const PRIORITY_MAP    = { urgent: 'high' } as Record<string, Priority>;
const VALID_PRIORITIES = new Set<string>(['low', 'medium', 'high']);

function toStatus(s: string): Status {
  if (VALID_STATUSES.has(s)) return s as Status;
  return STATUS_MAP[s] ?? 'Nový';
}
function toPriority(p: string): Priority {
  if (VALID_PRIORITIES.has(p)) return p as Priority;
  return PRIORITY_MAP[p] ?? 'medium';
}

function buildPipelines(
  dbPipelines: DbPipeline[],
  dbTasks: DbTask[],
  dbComments: DbComment[],
  dbFiles: DbFile[],
): Pipeline[] {
  const localArchived = getLocalArchived();

  const commentsByTask = new Map<string, Comment[]>();
  for (const c of dbComments) {
    const arr = commentsByTask.get(c.task_id) ?? [];
    arr.push({ id: c.id, author: c.author, body: c.body, createdAt: c.created_at });
    commentsByTask.set(c.task_id, arr);
  }

  const filesByTask = new Map<string, TaskFile[]>();
  for (const f of dbFiles) {
    const arr = filesByTask.get(f.task_id) ?? [];
    arr.push({ id: f.id, name: f.name, url: f.url, size: f.size, createdAt: f.created_at });
    filesByTask.set(f.task_id, arr);
  }

  const tasksByPipeline = new Map<string, Task[]>();
  for (const t of dbTasks) {
    const arr = tasksByPipeline.get(t.pipeline_id) ?? [];
    // archived: use DB value if it exists, otherwise fall back to localStorage
    const dbArchived = t.archived ?? false;
    arr.push({
      id: t.id, title: t.title, description: t.description,
      status: toStatus(t.status), priority: toPriority(t.priority),
      order: t.order_index, assignee: t.assignee, deadline: t.deadline,
      assetLinks: t.asset_links ?? [], createdAt: t.created_at,
      completedAt: t.completed_at ?? '',
      archived: dbArchived || localArchived.has(t.id),
      comments: commentsByTask.get(t.id) ?? [],
      files: filesByTask.get(t.id) ?? [],
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
  const [loading, setLoading]     = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── fetchAll ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    const [
      { data: dbPipelines },
      { data: dbTasks },
      { data: dbComments },
      { data: dbFiles },
    ] = await Promise.all([
      supabase.from('pipelines').select('*').order('created_at'),
      supabase.from('tasks').select('*').order('order_index'),
      supabase.from('comments').select('*').order('created_at'),
      // task_files table may not exist – ignore error
      supabase.from('task_files').select('*').order('created_at'),
    ]);

    const tasks = (dbTasks as DbTask[]) ?? [];

    // Auto-archive Hotovo tasks older than 3 days — only if completed_at column exists
    const now = Date.now();
    const toAutoArchive = tasks.filter(t =>
      t.status === 'Hotovo' && !t.archived &&
      t.completed_at && (now - new Date(t.completed_at).getTime()) > THREE_DAYS_MS
    );
    if (toAutoArchive.length > 0) {
      await Promise.all(toAutoArchive.map(t =>
        supabase.from('tasks').update({ archived: true }).eq('id', t.id)
      ));
      for (const t of toAutoArchive) {
        t.archived = true;
        toggleLocalArchived(t.id, true);
      }
    }

    const pipelines = buildPipelines(
      (dbPipelines as DbPipeline[]) ?? [],
      tasks,
      (dbComments as DbComment[]) ?? [],
      (dbFiles as DbFile[]) ?? [],
    );

    setState(prev => {
      const activeStillExists = pipelines.some(p => p.id === prev.activePipelineId);
      const activePipelineId  = activeStillExists ? prev.activePipelineId : (pipelines[0]?.id ?? null);
      return { pipelines, activePipelineId };
    });
  }, []);

  const scheduleFetch = useCallback(() => {
    if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(fetchAll, 150);
  }, [fetchAll]);

  // ─── trySave ───────────────────────────────────────────────────────────────
  // Awaits a Supabase write and surfaces errors WITHOUT reverting optimistic state.
  // Accepts PromiseLike so PostgrestFilterBuilder (thenable, not full Promise) works.
  const trySave = useCallback(async (p: PromiseLike<{ error: unknown }>) => {
    const { error } = await p;
    if (error) {
      const msg = (error as { message?: string })?.message ?? 'Neznáma chyba.';
      console.error('[product-pipeline] Supabase write error:', error);
      // Show error but KEEP the optimistic update – do not revert state
      setLastError(msg);
      return false;
    }
    return true;
  }, []);

  const clearError = useCallback(() => setLastError(null), []);

  // ─── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    fetchAll().finally(() => setLoading(false));

    const channel = supabase
      .channel('db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pipelines' }, scheduleFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' },     scheduleFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' },  scheduleFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'task_files' }, scheduleFetch)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current);
    };
  }, [fetchAll, scheduleFetch]);

  const activePipeline = state.pipelines.find(p => p.id === state.activePipelineId) ?? null;

  // ─── Pipeline actions ──────────────────────────────────────────────────────
  const setActivePipeline = useCallback((id: string) => {
    localStorage.setItem(ACTIVE_KEY, id);
    setState(prev => ({ ...prev, activePipelineId: id }));
  }, []);

  const createPipeline = useCallback(async (name: string) => {
    const id        = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    setState(prev => ({
      ...prev,
      pipelines: [...prev.pipelines, { id, name, tasks: [], createdAt }],
      activePipelineId: id,
    }));
    localStorage.setItem(ACTIVE_KEY, id);
    await trySave(supabase.from('pipelines').insert({ id, name }));
  }, [trySave]);

  const renamePipeline = useCallback(async (id: string, name: string) => {
    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p => p.id === id ? { ...p, name } : p),
    }));
    await trySave(supabase.from('pipelines').update({ name }).eq('id', id));
  }, [trySave]);

  const deletePipeline = useCallback(async (id: string) => {
    setState(prev => {
      const pipelines      = prev.pipelines.filter(p => p.id !== id);
      const activePipelineId = prev.activePipelineId === id
        ? (pipelines[0]?.id ?? null) : prev.activePipelineId;
      if (activePipelineId) localStorage.setItem(ACTIVE_KEY, activePipelineId);
      else localStorage.removeItem(ACTIVE_KEY);
      return { ...prev, pipelines, activePipelineId };
    });
    await trySave(supabase.from('pipelines').delete().eq('id', id));
  }, [trySave]);

  // ─── Task actions ──────────────────────────────────────────────────────────
  const createTask = useCallback(async (title: string, pipelineId: string) => {
    const pipeline = state.pipelines.find(p => p.id === pipelineId);
    if (!pipeline) return;

    const id         = crypto.randomUUID();
    const createdAt  = new Date().toISOString();
    const orderIndex = pipeline.tasks.reduce((m, t) => Math.max(m, t.order), -1) + 1;

    const task: Task = {
      id, title, description: '', status: 'Nový', priority: 'medium',
      assignee: '', deadline: '', assetLinks: [], comments: [], files: [],
      createdAt, completedAt: '', archived: false, order: orderIndex,
    };

    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p =>
        p.id === pipelineId ? { ...p, tasks: [...p.tasks, task] } : p,
      ),
    }));

    // Insert only columns that exist in DB — archived & completed_at excluded
    await trySave(supabase.from('tasks').insert({
      id, pipeline_id: pipelineId, title, description: '',
      status: 'Nový', priority: 'medium', assignee: '', deadline: '',
      asset_links: [], order_index: orderIndex,
    }));
  }, [state.pipelines, trySave]);

  const updateTask = useCallback(async (taskId: string, patch: Partial<Task>, pipelineId: string) => {
    const augmented: Partial<Task> = { ...patch };

    // Auto-set completedAt in local state when moving to Hotovo
    if (patch.status === 'Hotovo') {
      augmented.completedAt = new Date().toISOString();
    }
    // Auto-unarchive in local state when moving away from Hotovo
    if (patch.status && patch.status !== 'Hotovo') {
      augmented.archived = false;
      toggleLocalArchived(taskId, false);
    }

    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p =>
        p.id === pipelineId
          ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, ...augmented } : t) }
          : p,
      ),
    }));

    // Only include DB columns that actually exist
    const dbPatch: Record<string, unknown> = {};
    if (augmented.title       !== undefined) dbPatch.title       = augmented.title;
    if (augmented.description !== undefined) dbPatch.description = augmented.description;
    if (augmented.status      !== undefined) dbPatch.status      = augmented.status;
    if (augmented.priority    !== undefined) dbPatch.priority    = augmented.priority;
    if (augmented.assignee    !== undefined) dbPatch.assignee    = augmented.assignee;
    if (augmented.deadline    !== undefined) dbPatch.deadline    = augmented.deadline;
    if (augmented.assetLinks  !== undefined) dbPatch.asset_links = augmented.assetLinks;
    if (augmented.order       !== undefined) dbPatch.order_index = augmented.order;
    // completed_at and archived skipped — columns don't exist in DB yet

    if (Object.keys(dbPatch).length > 0) {
      await trySave(supabase.from('tasks').update(dbPatch).eq('id', taskId));
    }
  }, [trySave]);

  const deleteTask = useCallback(async (taskId: string, pipelineId: string) => {
    toggleLocalArchived(taskId, false);
    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p =>
        p.id === pipelineId
          ? { ...p, tasks: p.tasks.filter(t => t.id !== taskId) }
          : p,
      ),
    }));
    await trySave(supabase.from('tasks').delete().eq('id', taskId));
  }, [trySave]);

  const archiveTask = useCallback(async (taskId: string, pipelineId: string) => {
    toggleLocalArchived(taskId, true);
    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p =>
        p.id === pipelineId
          ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, archived: true } : t) }
          : p,
      ),
    }));
    // Silent — column may not exist; localStorage is the source of truth
    supabase.from('tasks').update({ archived: true }).eq('id', taskId).then(() => {});
  }, []);

  const reorderTasks = useCallback(async (orderedIds: string[], pipelineId: string) => {
    const orderedSet = new Set(orderedIds);

    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p => {
        if (p.id !== pipelineId) return p;
        const taskMap = new Map(p.tasks.map(t => [t.id, t]));
        const reorderedTasks = orderedIds
          .map((id, index) => { const t = taskMap.get(id); return t ? { ...t, order: index } : null; })
          .filter(Boolean) as Task[];
        const otherTasks = p.tasks
          .filter(t => !orderedSet.has(t.id))
          .map((t, i) => ({ ...t, order: orderedIds.length + i }));
        return { ...p, tasks: [...reorderedTasks, ...otherTasks] };
      }),
    }));

    await trySave(
      Promise.all(
        orderedIds.map((id, index) =>
          supabase.from('tasks').update({ order_index: index }).eq('id', id),
        ),
      )
        .then(results => ({ error: results.find(r => r.error)?.error ?? null }))
        .catch(err  => ({ error: err })),
    );
  }, [trySave]);

  // ─── Comment actions ───────────────────────────────────────────────────────
  const addComment = useCallback(async (taskId: string, author: string, body: string, pipelineId: string) => {
    const id        = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const comment: Comment = { id, author, body, createdAt };

    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p =>
        p.id === pipelineId
          ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, comments: [...t.comments, comment] } : t) }
          : p,
      ),
    }));

    await trySave(supabase.from('comments').insert({ id, task_id: taskId, author, body }));
  }, [trySave]);

  const updateComment = useCallback(async (
    taskId: string, commentId: string,
    patch: { author?: string; body?: string },
    pipelineId: string,
  ) => {
    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p =>
        p.id === pipelineId
          ? { ...p, tasks: p.tasks.map(t =>
              t.id === taskId
                ? { ...t, comments: t.comments.map(c => c.id === commentId ? { ...c, ...patch } : c) }
                : t) }
          : p,
      ),
    }));
    const dbPatch: Record<string, string> = {};
    if (patch.author !== undefined) dbPatch.author = patch.author;
    if (patch.body   !== undefined) dbPatch.body   = patch.body;
    if (Object.keys(dbPatch).length > 0) {
      await trySave(supabase.from('comments').update(dbPatch).eq('id', commentId));
    }
  }, [trySave]);

  const deleteComment = useCallback(async (taskId: string, commentId: string, pipelineId: string) => {
    setState(prev => ({
      ...prev,
      pipelines: prev.pipelines.map(p =>
        p.id === pipelineId
          ? { ...p, tasks: p.tasks.map(t =>
              t.id === taskId
                ? { ...t, comments: t.comments.filter(c => c.id !== commentId) }
                : t) }
          : p,
      ),
    }));
    await trySave(supabase.from('comments').delete().eq('id', commentId));
  }, [trySave]);

  // ─── File actions (task_files table may not exist) ─────────────────────────
  const uploadFile = useCallback(async (taskId: string, file: File, pipelineId: string) => {
    const ext  = file.name.split('.').pop();
    const path = `${taskId}/${crypto.randomUUID()}.${ext}`;

    let { error: uploadError } = await supabase.storage
      .from('task-attachments')
      .upload(path, file);

    // Try to create the bucket if it doesn't exist, then retry
    if (uploadError && /bucket not found/i.test(uploadError.message)) {
      await supabase.storage.createBucket('task-attachments', { public: true });
      const retry = await supabase.storage.from('task-attachments').upload(path, file);
      uploadError = retry.error;
    }

    if (uploadError) {
      setLastError(`Upload zlyhal: ${uploadError.message}. Over Supabase Storage — bucket "task-attachments" musí existovať a byť verejný.`);
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('task-attachments').getPublicUrl(path);

    const id        = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const taskFile: TaskFile = { id, name: file.name, url: publicUrl, size: file.size, createdAt };

    const ok = await trySave(supabase.from('task_files').insert({
      id, task_id: taskId, name: file.name, url: publicUrl, size: file.size,
    }));

    if (ok) {
      setState(prev => ({
        ...prev,
        pipelines: prev.pipelines.map(p =>
          p.id === pipelineId
            ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, files: [...t.files, taskFile] } : t) }
            : p,
        ),
      }));
    }
  }, [trySave]);

  const deleteFile = useCallback(async (taskId: string, fileId: string, fileUrl: string, pipelineId: string) => {
    const marker    = '/task-attachments/';
    const markerIdx = fileUrl.indexOf(marker);
    if (markerIdx !== -1) {
      const storagePath = fileUrl.slice(markerIdx + marker.length);
      await supabase.storage.from('task-attachments').remove([storagePath]);
    }

    const ok = await trySave(supabase.from('task_files').delete().eq('id', fileId));
    if (ok) {
      setState(prev => ({
        ...prev,
        pipelines: prev.pipelines.map(p =>
          p.id === pipelineId
            ? { ...p, tasks: p.tasks.map(t => t.id === taskId ? { ...t, files: t.files.filter(f => f.id !== fileId) } : t) }
            : p,
        ),
      }));
    }
  }, [trySave]);

  return {
    state,
    loading,
    lastError,
    clearError,
    activePipeline,
    setActivePipeline,
    createPipeline,
    renamePipeline,
    deletePipeline,
    createTask,
    updateTask,
    deleteTask,
    archiveTask,
    reorderTasks,
    addComment,
    updateComment,
    deleteComment,
    uploadFile,
    deleteFile,
  };
}
