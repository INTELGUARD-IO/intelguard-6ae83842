import { useEffect, useState } from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';
import { useUserRole } from '@/hooks/useUserRole';

export function AppLayout() {
  const [user, setUser] = useState<User | null>(null);
  const { isSuperAdmin, loading: roleLoading } = useUserRole();
  const navigate = useNavigate();

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate('/auth');
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  if (!user || roleLoading) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <nav className="flex items-center gap-6">
            <Link to="/dashboard" className="text-sm font-medium hover:text-primary transition-colors">
              Dashboard
            </Link>
            <Link to="/indicators" className="text-sm font-medium hover:text-primary transition-colors">
              Indicators
            </Link>
            <Link to="/feed-tokens" className="text-sm font-medium hover:text-primary transition-colors">
              Feed Tokens
            </Link>
            {isSuperAdmin && (
              <>
                <Link to="/system" className="text-sm font-medium hover:text-primary transition-colors">
                  System
                </Link>
                <Link to="/ingest-sources" className="text-sm font-medium hover:text-primary transition-colors">
                  Sources
                </Link>
                <Link to="/monitoring" className="text-sm font-medium hover:text-primary transition-colors">
                  Monitoring
                </Link>
              </>
            )}
          </nav>
          
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">{user.email}</span>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
