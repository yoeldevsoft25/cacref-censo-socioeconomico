import { useEffect, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageCircle, Send, User } from 'lucide-react';

interface Comment {
  id: number;
  author: string;
  author_role: string;
  body: string;
  created_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  director: 'bg-purple-100 text-purple-800',
  presidente: 'bg-blue-100 text-blue-800',
  vocal: 'bg-amber-100 text-amber-800',
  capturista: 'bg-slate-100 text-slate-700',
};

function formatTime(value: string): string {
  const then = new Date(value).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(value).toLocaleDateString('es-VE', { day: '2-digit', month: 'short' });
}

interface Props {
  submissionId: number;
  currentUser: { username: string; role: string; name: string };
  canComment: boolean;
}

export default function CommentsThread({ submissionId, currentUser, canComment }: Props) {
  const [items, setItems] = useState<Comment[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}/comments`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [submissionId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !canComment) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/submissions/${submissionId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ body }),
      });
      if (!res.ok) throw new Error('Error');
      const created = await res.json();
      setItems(prev => [...prev, created]);
      setDraft('');
    } catch (err) {
      console.error(err);
      alert('Error al enviar comentario');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-slate-500" />
          <h4 className="text-sm font-bold uppercase tracking-widest text-slate-700">
            Discusion del comite
          </h4>
          {items.length > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-semibold">
              {items.length}
            </span>
          )}
        </div>
        <button
          onClick={fetchComments}
          className="text-[10px] text-slate-400 hover:text-slate-700 uppercase tracking-wider font-semibold"
        >
          Actualizar
        </button>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {loading ? (
          <p className="text-xs text-slate-400 py-2">Cargando comentarios...</p>
        ) : items.length === 0 ? (
          <p className="text-xs text-slate-400 italic py-2">Sin comentarios. Inicia la discusion del caso.</p>
        ) : (
          <AnimatePresence initial={false}>
            {items.map(c => {
              const isMine = c.author === currentUser.username;
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2.5 ${isMine ? 'flex-row-reverse' : ''}`}
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-slate-600" />
                  </div>
                  <div className={`flex-1 min-w-0 max-w-[80%] ${isMine ? 'items-end' : ''} flex flex-col`}>
                    <div className={`flex items-center gap-2 mb-1 ${isMine ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs font-semibold text-slate-900">{c.author}</span>
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase ${ROLE_COLORS[c.author_role] || 'bg-slate-100 text-slate-700'}`}>
                        {c.author_role}
                      </span>
                      <span className="text-[10px] text-slate-400">{formatTime(c.created_at)}</span>
                    </div>
                    <div className={`px-3 py-2 rounded-2xl text-xs leading-relaxed whitespace-pre-wrap break-words ${isMine ? 'bg-red-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                      {c.body}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {canComment ? (
        <form onSubmit={handleSubmit} className="flex items-end gap-2 pt-2 border-t border-slate-100">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Escribe un comentario..."
            maxLength={2000}
            rows={2}
            className="flex-1 text-xs px-3 py-2 border border-slate-200 rounded-lg resize-none focus:outline-none focus:border-red-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                handleSubmit(e as any);
              }
            }}
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? '...' : 'Enviar'}
          </button>
        </form>
      ) : (
        <p className="text-[10px] text-slate-400 italic pt-2 border-t border-slate-100">
          Tu rol ({currentUser.role}) no permite agregar comentarios.
        </p>
      )}
    </div>
  );
}
