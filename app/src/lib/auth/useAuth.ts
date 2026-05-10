// Auth hook — wraps the store + API for screens.
import { useStore } from '../api/store';
import { api } from '../api/client';
import type { Brand, Creator, User } from '../api/types';
import { useMemo } from 'react';

export interface AuthValue {
  user: User | null;
  creator?: Creator;
  brand?: Brand;
  isAuthed: boolean;
  isCreator: boolean;
  isBrand: boolean;
  isAdmin: boolean;
}

export function useAuth(): AuthValue {
  const session = useStore((s) => s.session);
  const db = useStore((s) => s.db);

  return useMemo(() => {
    const user = session ? db.users.find((u) => u.id === session.userId) || null : null;
    const profiles = user ? api.auth.profileForUser(user) : {};
    return {
      user,
      creator: profiles.creator,
      brand: profiles.brand,
      isAuthed: !!user,
      isCreator: user?.role === 'creator',
      isBrand: user?.role === 'brand',
      isAdmin: user?.role === 'admin',
    };
  }, [session, db]);
}
