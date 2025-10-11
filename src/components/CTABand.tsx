import { Button } from '@/components/ui/button';
import { Check, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const benefits = [
  'No credit card required',
  'Setup in under 5 minutes',
  'Multi-vendor validation',
  'Real-time feed updates',
];

export const CTABand = () => {
  const navigate = useNavigate();

  return (
    <div className="relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 bg-gradient-accent opacity-20 blur-3xl" />
      
      <div className="relative bg-gradient-to-r from-accent/10 via-accent/20 to-accent/10 border-y border-accent/30 py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Ready to strengthen your defenses?
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-center gap-2 text-left">
                  <Check className="h-5 w-5 text-accent flex-shrink-0" />
                  <span className="text-body">{benefit}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-center gap-4">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-white shadow-glow-accent"
                onClick={() => navigate('/auth?trial=true')}
              >
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Reduced trial; for evaluation only.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
