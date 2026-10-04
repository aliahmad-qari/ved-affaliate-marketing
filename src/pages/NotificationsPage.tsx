import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '../components/ui/Button.tsx';
import { fetchPartnerNotifications, markAllPartnerNotificationsRead, markPartnerNotificationRead } from '../services/partnerApi.ts';

export const NotificationsPage: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setError('');
      const result = await fetchPartnerNotifications();
      setItems(result.data);
      setUnread(result.unreadCount);
    } catch (err: any) { setError(err.message || 'Unable to load notifications.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const markRead = async (id: string) => {
    try {
      await markPartnerNotificationRead(id);
      await load();
    } catch (err: any) { setError(err.message || 'Unable to update notification.'); }
  };

  const markAll = async () => {
    try {
      await markAllPartnerNotificationsRead();
      await load();
    } catch (err: any) { setError(err.message || 'Unable to update notifications.'); }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between border-b border-[#1C273C] pb-4">
        <div><div className="flex items-center gap-2 text-[#D4AF37]"><Bell className="h-5 w-5" /><span className="text-xs font-bold uppercase">Partner updates</span></div><h1 className="mt-1 text-2xl font-bold text-white">Notifications <span className="text-base text-[#AAB3C2]">{unread} unread</span></h1></div>
        <Button variant="outline" size="sm" onClick={markAll} disabled={!unread}><CheckCheck className="mr-2 h-4 w-4" />Mark all read</Button>
      </header>
      {error && <p role="alert" className="border border-rose-800 bg-rose-950/40 p-3 text-sm text-rose-200">{error}</p>}
      {loading ? <p className="py-10 text-center text-sm text-[#AAB3C2]">Loading notifications…</p> : items.length === 0 ? <p className="border border-[#263650] bg-[#0D1424] p-8 text-center text-sm text-[#AAB3C2]">No notifications yet.</p> : <div className="divide-y divide-[#263650] border border-[#263650] bg-[#0D1424]">{items.map((item) => <article key={item._id} className={`flex items-start justify-between gap-4 p-4 ${item.readAt ? '' : 'bg-[#111A2D]'}`}><div><div className="flex items-center gap-2"><h2 className="font-semibold text-white">{item.title}</h2>{!item.readAt && <span className="h-2 w-2 rounded-full bg-[#D4AF37]" />}</div><p className="mt-1 whitespace-pre-wrap text-sm text-[#AAB3C2]">{item.message}</p><p className="mt-2 text-[11px] text-[#718096]">{new Date(item.createdAt).toLocaleString()} · {item.type.replaceAll('_', ' ')}</p></div>{!item.readAt && <button className="shrink-0 text-xs text-[#D4AF37] underline" onClick={() => void markRead(item._id)}>Mark read</button>}</article>)}</div>}
    </div>
  );
};