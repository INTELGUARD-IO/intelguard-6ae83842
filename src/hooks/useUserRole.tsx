import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useUserRole() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkRoles();
  }, []);

  const checkRoles = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAdmin(false);
        setIsSuperAdmin(false);
        setLoading(false);
        return;
      }

      // Check if user is super admin (app creator)
      const { data: superAdminData } = await supabase
        .rpc('is_super_admin', { _user_id: user.id });
      
      setIsSuperAdmin(superAdminData || false);

      // Check if user is admin in their tenant
      const { data, error } = await supabase
        .from('tenant_members')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      setIsAdmin(data?.role === 'admin');
    } catch (err) {
      console.error('Error checking roles:', err);
      setError(err instanceof Error ? err.message : 'Failed to check roles');
      setIsAdmin(false);
      setIsSuperAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return { isAdmin, isSuperAdmin, loading, error };
}
