import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ChevronRight, MoreHorizontal, Pencil, Trash2, Layers } from 'lucide-react';
import type { Pipeline } from '../types';

interface SidebarProps {
  pipelines: Pipeline[];
  activePipelineId: string | null;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
}

interface MenuState {
  id: string;
  x: number;
  y: number;
}

export function Sidebar({ pipelines, activePipelineId, onSelect, onCreate, onRename, onDelete }: SidebarProps) {
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menu, setMenu] = useState<MenuState | null>(null);
  const newInputRef = useRef<HTMLInputElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creating) newInputRef.current?.focus();
  }, [creating]);

  useEffect(() => {
    if (renaming) renameInputRef.current?.focus();
  }, [renaming]);

  useEffect(() => {
    function handleClick() { setMenu(null); }
    if (menu) document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [menu]);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (name) onCreate(name);
    setCreating(false);
    setNewName('');
  }

  function handleRename(e: React.FormEvent, id: string) {
    e.preventDefault();
    const name = renameValue.trim();
    if (name) onRename(id, name);
    setRenaming(null);
  }

  function openMenu(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    setMenu({ id, x: e.clientX, y: e.clientY });
  }

  return (
    <>
      <aside className="w-56 flex-shrink-0 h-full border-r border-[#1e1e1e] flex flex-col bg-[#0f0f0f]">
        <div className="px-4 pt-5 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[#888] text-xs font-medium uppercase tracking-wider">
            <Layers size={12} />
            Pipelines
          </div>
          <button
            onClick={() => setCreating(true)}
            className="text-[#555] hover:text-white transition-colors p-1 rounded hover:bg-[#1e1e1e]"
          >
            <Plus size={14} />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          <AnimatePresence>
            {pipelines.map(p => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
              >
                {renaming === p.id ? (
                  <form onSubmit={e => handleRename(e, p.id)} className="px-2 py-1">
                    <input
                      ref={renameInputRef}
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      onBlur={() => setRenaming(null)}
                      onKeyDown={e => e.key === 'Escape' && setRenaming(null)}
                      className="w-full bg-[#1e1e1e] border border-[#333] rounded-lg px-2 py-1.5 text-sm text-white outline-none"
                    />
                  </form>
                ) : (
                  <button
                    onClick={() => onSelect(p.id)}
                    className={`group w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-all ${
                      activePipelineId === p.id
                        ? 'bg-[#1a1a1a] text-white'
                        : 'text-[#888] hover:text-white hover:bg-[#161616]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronRight
                        size={12}
                        className={`flex-shrink-0 transition-transform ${
                          activePipelineId === p.id ? 'rotate-90 text-white' : 'text-[#444]'
                        }`}
                      />
                      <span className="truncate">{p.name}</span>
                    </div>
                    <button
                      onClick={e => openMenu(e, p.id)}
                      className="opacity-0 group-hover:opacity-100 text-[#555] hover:text-white p-0.5 rounded transition-all flex-shrink-0"
                    >
                      <MoreHorizontal size={12} />
                    </button>
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          <AnimatePresence>
            {creating && (
              <motion.form
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                onSubmit={handleCreate}
                className="px-2 py-1 mt-1"
              >
                <input
                  ref={newInputRef}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onBlur={() => { setCreating(false); setNewName(''); }}
                  onKeyDown={e => e.key === 'Escape' && setCreating(false)}
                  placeholder="Pipeline name..."
                  className="w-full bg-[#1e1e1e] border border-[#333] rounded-lg px-2 py-1.5 text-sm text-white placeholder-[#444] outline-none focus:border-[#444]"
                />
              </motion.form>
            )}
          </AnimatePresence>

          {pipelines.length === 0 && !creating && (
            <p className="text-[#444] text-xs px-2 mt-2">No pipelines yet</p>
          )}
        </nav>
      </aside>

      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            style={{ position: 'fixed', top: menu.y, left: menu.x, zIndex: 100 }}
            className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl shadow-2xl p-1 min-w-[140px]"
          >
            <button
              onClick={e => {
                e.stopPropagation();
                const p = pipelines.find(p => p.id === menu.id);
                setRenameValue(p?.name ?? '');
                setRenaming(menu.id);
                setMenu(null);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#ccc] hover:text-white hover:bg-[#222] rounded-lg transition-colors"
            >
              <Pencil size={13} />
              Rename
            </button>
            <button
              onClick={e => {
                e.stopPropagation();
                onDelete(menu.id);
                setMenu(null);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-[#222] rounded-lg transition-colors"
            >
              <Trash2 size={13} />
              Delete
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
