import { useState, useEffect, useCallback } from 'react';
import { calendarService } from '../services/calendarService';
import type { AdminRole } from '../types/calendar';

export function useAdminAuth(userId?: string | null, userEmail?: string | null) {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isPrimaryAdmin, setIsPrimaryAdmin] = useState<boolean>(false);
  const [role, setRole] = useState<AdminRole | null>(null);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState<boolean>(Boolean(userId));

  const checkStatus = useCallback(async () => {
    if (!userId) {
      setIsAdmin(false);
      setIsPrimaryAdmin(false);
      setRole(null);
      setIsCheckingAdmin(false);
      return;
    }
    setIsCheckingAdmin(true);
    try {
      const res = await calendarService.checkAdminStatus(userId, userEmail);
      setIsAdmin(res.isAdmin);
      setIsPrimaryAdmin(res.isPrimaryAdmin);
      setRole(res.role);
    } catch {
      setIsAdmin(false);
      setIsPrimaryAdmin(false);
      setRole(null);
    } finally {
      setIsCheckingAdmin(false);
    }
  }, [userId, userEmail]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  return {
    isAdmin,
    isPrimaryAdmin,
    role,
    isCheckingAdmin,
    refreshAdminStatus: checkStatus,
  };
}
