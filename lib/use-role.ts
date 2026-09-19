'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type RoleState = {
  status: 'checking' | 'denied' | 'allowed';
  isAdmin: boolean;
  userId: string | null;
};

export function useRole(): RoleState {
  const [state, setState] = useState<RoleState>({
    status: 'checking',
    isAdmin: false,
    userId: null,
  });

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!supabase) {
        if (active) setState({ status: 'denied', isAdmin: false, userId: null });
        return;
      }

      const { data } = await supabase.auth.getUser();

      if (!active) return;

      if (!data.user) {
        setState({ status: 'denied', isAdmin: false, userId: null });
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!active) return;

      const role = (profile as { role?: string } | null)?.role;
      setState({
        status: role === 'admin' || role === 'teacher' ? 'allowed' : 'denied',
        isAdmin: role === 'admin',
        userId: data.user.id,
      });
    };

    run();

    return () => {
      active = false;
    };
  }, []);

  return state;
}
