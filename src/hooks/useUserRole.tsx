import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useUserRole() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkAdminRole();
  }, []);

  const checkAdminRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('tenant_members')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      
      setIsAdmin(data?.role === 'admin');
    } catch (err) {
      console.error('Error checking admin role:', err);
      setError(err instanceof Error ? err.message : 'Failed to check role');
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return { isAdmin, loading, error };
}
