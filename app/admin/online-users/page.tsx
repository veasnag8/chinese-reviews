'use client';

import { OnlineUsersPanel } from '@/components/admin/online-users';

export default function AdminOnlineUsersPage() {
  return (
    <div className="min-h-screen bg-[#f7f6f3] p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#b91c1c]">Administration</p>
          <h1 className="mt-1 text-3xl font-bold">Online Admin Users</h1>
          <p className="mt-2 text-slate-500">View real-time online status of admin and teacher users.</p>
        </div>

        <OnlineUsersPanel />
      </div>
    </div>
  );
}