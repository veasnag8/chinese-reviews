'use client';

import { useEffect, useState } from 'react';
import { UserCheck, UserX, Wifi, WifiOff, RefreshCw, Shield } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type OnlineUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  last_active_at: string | null;
  is_online: boolean;
  created_at: string;
};

export function OnlineUsersPanel() {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [adminUsers, setAdminUsers] = useState<OnlineUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setError('Supabase client not configured');
      setLoading(false);
      return;
    }

    let active = true;

    const fetchUsers = async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_all_users_with_activity');
        if (rpcError) throw rpcError;
        if (!active) return;
        
        const users = (data || []) as OnlineUser[];
        const admins = users.filter(u => u.role === 'admin' || u.role === 'teacher');
        const online = users.filter(u => u.is_online);
        
        setAdminUsers(admins);
        setOnlineUsers(online);
      } catch (err) {
        console.error('Error fetching users:', err);
        if (active) setError('Failed to load users');
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchUsers();

    const channel = supabase
      .channel('online-users-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: 'is_online=eq.true',
        },
        (payload) => {
          if (!active) return;
          
          const user = payload.new as OnlineUser | null;
          const oldUser = payload.old as OnlineUser | null;

          if (payload.eventType === 'UPDATE' && user) {
            setOnlineUsers(prev => {
              const exists = prev.find(u => u.id === user.id);
              if (exists) {
                return prev.map(u => u.id === user.id ? { ...u, ...user } : u);
              }
              if (user.is_online) {
                return [...prev, user];
              }
              return prev;
            });
            
            setAdminUsers(prev => {
              const exists = prev.find(u => u.id === user.id);
              if (exists) {
                return prev.map(u => u.id === user.id ? { ...u, ...user } : u);
              }
              if ((user.role === 'admin' || user.role === 'teacher') && user.is_online) {
                return [...prev, user];
              }
              return prev;
            });
          } else if (payload.eventType === 'DELETE' && oldUser) {
            setOnlineUsers(prev => prev.filter(u => u.id !== oldUser.id));
            setAdminUsers(prev => prev.filter(u => u.id !== oldUser.id));
          }
        }
      )
      .subscribe();

    const interval = setInterval(fetchUsers, 30000);

    return () => {
      active = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  const formatLastActive = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-stone-200 bg-white p-6">
        <div className="flex items-center gap-2 text-slate-500">
          <RefreshCw className="animate-spin" size={20} />
          <span>Loading online users...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  const onlineAdmins = adminUsers.filter(u => u.is_online);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="text-[#b91c1c]" size={20} />
          <h3 className="text-lg font-semibold">Online Admin Users</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
          <Wifi className="text-emerald-500" size={12} />
          {onlineAdmins.length} online
        </span>
      </div>

      {onlineAdmins.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 p-8 text-center text-slate-500">
          <WifiOff className="mx-auto text-stone-300" size={32} />
          <p className="mt-2">No admin users currently online</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-3 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-stone-100">
            <div className="col-span-5">User</div>
            <div className="col-span-3">Role</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Last Active</div>
          </div>
          <div className="divide-y divide-stone-100">
            {onlineAdmins.map((user) => (
              <div key={user.id} className="grid grid-cols-12 gap-4 p-3 items-center hover:bg-stone-50 transition">
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-[#b91c1c]/10 flex items-center justify-center flex-shrink-0">
                    <UserCheck className="text-[#b91c1c]" size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{user.full_name || 'Unnamed'}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <div className="col-span-3">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-[#b91c1c]/10 text-[#b91c1c]">
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                </div>
                <div className="col-span-2 text-xs text-slate-500">
                  {formatLastActive(user.last_active_at)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {adminUsers.filter(u => !u.is_online).length > 0 && (
        <details className="group rounded-2xl border border-stone-200 bg-white">
          <summary className="flex items-center justify-between p-4 cursor-pointer list-none">
            <div className="flex items-center gap-2">
              <UserX className="text-stone-400" size={20} />
              <h4 className="font-medium text-slate-700">Offline Admin Users</h4>
            </div>
            <span className="text-sm text-slate-500">{adminUsers.filter(u => !u.is_online).length} users</span>
          </summary>
          <div className="divide-y divide-stone-100 px-4 pb-4">
            {adminUsers.filter(u => !u.is_online).map((user) => (
              <div key={user.id} className="grid grid-cols-12 gap-4 py-3 items-center">
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center flex-shrink-0">
                    <UserX className="text-stone-400" size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 truncate">{user.full_name || 'Unnamed'}</p>
                    <p className="text-xs text-slate-500 truncate">{user.email}</p>
                  </div>
                </div>
                <div className="col-span-3">
                  <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium bg-stone-100 text-stone-600">
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold bg-stone-50 text-stone-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                    Offline
                  </span>
                </div>
                <div className="col-span-2 text-xs text-slate-500">
                  {formatLastActive(user.last_active_at)}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}