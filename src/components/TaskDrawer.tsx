import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Trash2, Calendar, User, Link, MessageSquare,
  ChevronDown, Plus, Send,
} from 'lucide-react';
import type { Task, Priority, Status, Comment } from '../types';

interface TaskDrawerProps {
  task: Task | null;
  onClose: () => void;
  onUpdate: (id: string, patch: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAddComment: (taskId: string, author: string, body: string) => void;
}

const priorities: Priority[] = ['low', 'medium', 'high', 'urgent'];
const statuses: Status[] = ['backlog', 'todo', 'in-progress', 'review', 'done'];

const priorityColors: Record<Priority, string> = {
  low: 'text-[#555]',
  medium: 'text-yellow-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
};

const statusColors: Record<Status, string> = {
  backlog: 'bg-[#222] text-[#888]',
  todo: 'bg-[#1e3a5f] text-blue-300',
  'in-progress': 'bg-[#2d1f5e] text-purple-300',
  review: 'bg-[#3a2d00] text-yellow-300',
  done: 'bg-[#1a3a2a] text-green-300',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-3 border-b border-[#1a1a1a]">
      <div className="w-24 flex-shrink-0 text-xs text-[#555] pt-0.5">{label}</div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function InlineEdit({
  value,
  onChange,
  placeholder,
  multiline,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const ref = useRef<HTMLTextAreaElement & HTMLInputElement>(null);

  useEffect(() => { setLocal(value); }, [value]);
  useEffect(() => { if (editing) ref.current?.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    if (local !== value) onChange(local);
  }

  if (multiline) {
    return editing ? (
      <textarea
        ref={ref as React.RefObject<HTMLTextAreaElement>}
        value={local}
        onChange={e => setLocal(e.target.value)}
        onBlur={commit}
        onKeyDown={e => e.key === 'Escape' && commit()}
        rows={4}
        className={`w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-sm text-white placeholder-[#444] outline-none resize-none ${className}`}
        placeholder={placeholder}
      />
    ) : (
      <p
        onClick={() => setEditing(true)}
        className={`text-sm cursor-text leading-relaxed ${value ? 'text-[#aaa]' : 'text-[#444] italic'} hover:text-white transition-colors ${className}`}
      >
        {value || placeholder}
      </p>
    );
  }

  return editing ? (
    <input
      ref={ref as React.RefObject<HTMLInputElement>}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') commit(); }}
      className={`w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-sm text-white placeholder-[#444] outline-none ${className}`}
      placeholder={placeholder}
    />
  ) : (
    <p
      onClick={() => setEditing(true)}
      className={`text-sm cursor-text ${value ? 'text-[#aaa]' : 'text-[#444] italic'} hover:text-white transition-colors ${className}`}
    >
      {value || placeholder}
    </p>
  );
}

function AssetLinks({ links, onChange }: { links: string[]; onChange: (l: string[]) => void }) {
  const [adding, setAdding] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (adding) inputRef.current?.focus(); }, [adding]);

  function add() {
    const url = value.trim();
    if (url) onChange([...links, url]);
    setAdding(false);
    setValue('');
  }

  return (
    <div className="space-y-1.5">
      {links.map((link, i) => (
        <div key={i} className="flex items-center gap-2 group">
          <Link size={12} className="text-[#555] flex-shrink-0" />
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-400 hover:text-blue-300 truncate flex-1 transition-colors"
            onClick={e => e.stopPropagation()}
          >
            {link}
          </a>
          <button
            onClick={() => onChange(links.filter((_, j) => j !== i))}
            className="opacity-0 group-hover:opacity-100 text-[#555] hover:text-red-400 transition-all"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      {adding ? (
        <input
          ref={inputRef}
          value={value}
          onChange={e => setValue(e.target.value)}
          onBlur={add}
          onKeyDown={e => { if (e.key === 'Enter') add(); if (e.key === 'Escape') { setAdding(false); setValue(''); } }}
          placeholder="Paste URL..."
          className="w-full bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-1.5 text-xs text-white placeholder-[#444] outline-none"
        />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex items-center gap-1 text-xs text-[#444] hover:text-[#888] transition-colors"
        >
          <Plus size={12} />
          Add link
        </button>
      )}
    </div>
  );
}

function CommentThread({
  comments,
  onAdd,
}: {
  comments: Comment[];
  onAdd: (author: string, body: string) => void;
}) {
  const [author, setAuthor] = useState('');
  const [body, setBody] = useState('');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim()) {
      onAdd(author.trim() || 'Anonymous', body.trim());
      setBody('');
    }
  }

  return (
    <div className="space-y-4">
      {comments.map(c => (
        <div key={c.id} className="flex gap-3">
          <div className="w-6 h-6 rounded-full bg-[#2a2a2a] flex items-center justify-center flex-shrink-0 text-[10px] font-medium text-[#888] uppercase">
            {c.author.charAt(0)}
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-xs font-medium text-[#ccc]">{c.author}</span>
              <span className="text-[10px] text-[#444]">
                {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
            </div>
            <p className="text-xs text-[#888] leading-relaxed">{c.body}</p>
          </div>
        </div>
      ))}

      <form onSubmit={submit} className="flex gap-2">
        <input
          value={author}
          onChange={e => setAuthor(e.target.value)}
          placeholder="Name"
          className="w-20 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-2 py-2 text-xs text-white placeholder-[#444] outline-none flex-shrink-0"
        />
        <input
          value={body}
          onChange={e => setBody(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg px-3 py-2 text-xs text-white placeholder-[#444] outline-none"
        />
        <button
          type="submit"
          disabled={!body.trim()}
          className="text-[#555] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors p-2"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}

export function TaskDrawer({ task, onClose, onUpdate, onDelete, onAddComment }: TaskDrawerProps) {
  function patch<K extends keyof Task>(key: K, value: Task[K]) {
    if (task) onUpdate(task.id, { [key]: value });
  }

  return (
    <AnimatePresence>
      {task && (
        <>
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 z-40"
          />
          <motion.div
            key="drawer"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-[480px] bg-[#111] border-l border-[#1e1e1e] z-50 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a1a1a]">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { onDelete(task.id); onClose(); }}
                  className="text-[#444] hover:text-red-400 transition-colors p-1 rounded-lg hover:bg-[#1e1e1e]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <button
                onClick={onClose}
                className="text-[#444] hover:text-white transition-colors p-1 rounded-lg hover:bg-[#1e1e1e]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {/* Title */}
              <InlineEdit
                value={task.title}
                onChange={v => patch('title', v)}
                placeholder="Task title"
                className="text-xl font-semibold text-white mb-4 w-full"
              />

              {/* Fields */}
              <div className="mb-6">
                <Field label="Status">
                  <div className="flex flex-wrap gap-1">
                    {statuses.map(s => (
                      <button
                        key={s}
                        onClick={() => patch('status', s)}
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full transition-all ${
                          task.status === s ? statusColors[s] : 'bg-[#1a1a1a] text-[#555] hover:text-[#888]'
                        }`}
                      >
                        {s.replace('-', ' ')}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Priority">
                  <div className="flex gap-1">
                    {priorities.map(p => (
                      <button
                        key={p}
                        onClick={() => patch('priority', p)}
                        className={`text-xs px-2 py-0.5 rounded-lg capitalize transition-all ${
                          task.priority === p
                            ? `${priorityColors[p]} bg-[#1e1e1e]`
                            : 'text-[#444] hover:text-[#888] hover:bg-[#1a1a1a]'
                        }`}
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Assignee">
                  <div className="flex items-center gap-2">
                    <User size={13} className="text-[#555]" />
                    <InlineEdit
                      value={task.assignee}
                      onChange={v => patch('assignee', v)}
                      placeholder="Unassigned"
                    />
                  </div>
                </Field>

                <Field label="Deadline">
                  <div className="flex items-center gap-2">
                    <Calendar size={13} className="text-[#555]" />
                    <input
                      type="date"
                      value={task.deadline}
                      onChange={e => patch('deadline', e.target.value)}
                      className="bg-transparent text-sm text-[#aaa] outline-none cursor-pointer hover:text-white transition-colors [color-scheme:dark]"
                    />
                  </div>
                </Field>

                <Field label="Links">
                  <AssetLinks
                    links={task.assetLinks}
                    onChange={v => patch('assetLinks', v)}
                  />
                </Field>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h4 className="text-xs text-[#555] uppercase tracking-wider mb-3">Description</h4>
                <InlineEdit
                  value={task.description}
                  onChange={v => patch('description', v)}
                  placeholder="Add a description..."
                  multiline
                />
              </div>

              {/* Comments */}
              <div>
                <h4 className="text-xs text-[#555] uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MessageSquare size={12} />
                  Comments {task.comments.length > 0 && `(${task.comments.length})`}
                </h4>
                <CommentThread
                  comments={task.comments}
                  onAdd={(author, body) => onAddComment(task.id, author, body)}
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
