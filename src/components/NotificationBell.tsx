import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, CheckCircle2, FileText, UserPlus, X } from 'lucide-react';

interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  target_type: string | null;
  target_id: string | null;
  actor: string | null;
  read_at: string | null;
  created_at: string;
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  case_assigned: UserPlus,
  case_resolved: CheckCircle2,
  case_status_changed: FileText,
};

const TYPE_COLORS: Record<string, string> = {
  case_assigned: 'bg-blue-100 text-blue-600',
  case_resolved: 'bg-emerald-100 text-emerald-600',
  case_status_changed: 'bg-amber-100 text-amber-600',
};

function timeAgo(value: string): string {
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

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/admin/notifications?limit=20', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data?.data || []);
      setUnread(data?.unread || 0);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    const onFocus = () => fetchNotifications();
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const markRead = async (id: number) => {
    await fetch(`/api/admin/notifications/${id}/read`, { method: 'PATCH', credentials: 'include' });
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    setLoading(true);
    try {
      await fetch('/api/admin/notifications/read-all', { method: 'PATCH', credentials: 'include' });
      const now = new Date().toISOString();
      setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at || now })));
      setUnread(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative inline-flex items-center justify-center w-9 h-9 rounded-lg border border-slate-200 bg-white text-slate-600 hover:text-red-600 hover:border-red-300 transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-white"
          >
            {unread > 99 ? '99+' : unread}
          </motion.span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-96 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">Notificaciones</h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  {unread > 0 ? `${unread} sin leer` : 'Al dia'}
                </p>
              </div>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  disabled={loading}
                  className="text-[10px] font-semibold uppercase tracking-wider text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  Marcar todas
                </button>
              )}
            </div>

            <div className="max-h-[480px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-6 py-12 text-center text-slate-400 text-sm">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  Sin notificaciones
                </div>
              ) : (
                items.map(n => {
                  const Icon = TYPE_ICONS[n.type] || Bell;
                  const colorCls = TYPE_COLORS[n.type] || 'bg-slate-100 text-slate-600';
                  const isUnread = !n.read_at;
                  return (
                    <div
                      key={n.id}
                      onClick={() => isUnread && markRead(n.id)}
                      className={`px-4 py-3 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-50 ${isUnread ? 'bg-red-50/30' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colorCls}`}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-xs ${isUnread ? 'font-bold text-slate-900' : 'font-medium text-slate-700'}`}>
                              {n.title}
                            </p>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">{timeAgo(n.created_at)}</span>
                          </div>
                          {n.body && (
                            <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                          )}
                          {n.target_id && (
                            <p className="text-[10px] text-slate-400 mt-1 font-mono">
                              {n.target_type} #{n.target_id}
                            </p>
                          )}
                        </div>
                        {isUnread && (
                          <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1" />
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {items.length > 0 && (
              <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-center">
                <p className="text-[10px] text-slate-500">
                  Las notificaciones se actualizan cada 30 segundos
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
