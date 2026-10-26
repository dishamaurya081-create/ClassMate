import { useAdminAuth } from './useAdminAuth';

export function useCreatorAuth(userId?: string | null, userEmail?: string | null) {
  const { isAdmin, isPrimaryAdmin, role, isCheckingAdmin, refreshAdminStatus } = useAdminAuth(
    userId,
    userEmail
  );

  return {
    isCreator: isAdmin,
    isAdmin,
    isPrimaryAdmin,
    role,
    isCheckingCreator: isCheckingAdmin,
    refreshCreatorStatus: refreshAdminStatus,
  };
}

