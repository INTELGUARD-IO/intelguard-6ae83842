import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Shield, Activity, Globe, TrendingUp } from 'lucide-react';

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/dashboard');
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl">IntelGuard</span>
          </div>
          <Button onClick={() => navigate('/auth')}>Get Started</Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold">
              Threat Intelligence
              <br />
              <span className="text-primary">Made Simple</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Real-time validation and distribution of malicious indicators. 
              Protect your infrastructure with actionable threat intelligence.
            </p>
          </div>

          <div className="flex items-center justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/auth')}>
              Start Free Trial
            </Button>
            <Button size="lg" variant="outline">
              View Demo
            </Button>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mt-20">
            <div className="p-6 rounded-lg border border-border bg-card space-y-3">
              <Activity className="h-10 w-10 text-primary" />
              <h3 className="text-xl font-semibold">Real-time Validation</h3>
              <p className="text-muted-foreground">
                Automated validation of threat indicators from multiple sources
              </p>
            </div>

            <div className="p-6 rounded-lg border border-border bg-card space-y-3">
              <Globe className="h-10 w-10 text-primary" />
              <h3 className="text-xl font-semibold">Global Coverage</h3>
              <p className="text-muted-foreground">
                Track malicious IPs and domains across the globe
              </p>
            </div>

            <div className="p-6 rounded-lg border border-border bg-card space-y-3">
              <TrendingUp className="h-10 w-10 text-primary" />
              <h3 className="text-xl font-semibold">API Access</h3>
              <p className="text-muted-foreground">
                Easy integration with your security infrastructure
              </p>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-border mt-20">
        <div className="container mx-auto px-4 py-8 text-center text-muted-foreground">
          <p>© 2025 IntelGuard. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
