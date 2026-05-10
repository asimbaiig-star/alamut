import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth/useAuth';
import type { Role } from '@/lib/api/types';

interface Props {
  allow: Role[];
}

export function ProtectedRoute({ allow }: Props) {
  const { user } = useAuth();
  const loc = useLocation();
  if (!user) return <Navigate to="/signin" replace state={{ from: loc.pathname }} />;
  if (!allow.includes(user.role)) {
    // Wrong role — bounce them to their own role-default landing.
    // Today for creator/brand (Phase 4), Console for admin (Phase 8).
    if (user.role === 'creator') return <Navigate to="/creator/today" replace />;
    if (user.role === 'brand')   return <Navigate to="/brand/today" replace />;
    return <Navigate to="/admin/home" replace />;
  }
  return <Outlet />;
}
