import { HeroGeometric } from "@/components/ui/shape-landing-hero";
import { Button } from "@/components/ui/button";
import { Shield, Clock, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";

const TestHome = () => {
  const navigate = useNavigate();

  return (
    <HeroGeometric
      badge="True Threat Feeds©"
      title1="Block threats."
      title2="Not your business."
      description="Dynamic feeds of malicious indicators (IPs, domains, URLs) validated by analysts and powered by multi-vendor intelligence"
    >
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
        <Button
          size="lg"
          onClick={() => navigate("/auth?trial=true")}
          className="text-lg px-8"
        >
          Get Started Free
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => {
            const pricingSection = document.getElementById("pricing");
            if (pricingSection) {
              pricingSection.scrollIntoView({ behavior: "smooth" });
            }
          }}
          className="text-lg px-8"
        >
          View Pricing
        </Button>
      </div>

      <div className="flex flex-wrap gap-6 justify-center items-center text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-accent" />
          <span>Multi-vendor validation</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent" />
          <span>Real-time updates</span>
        </div>
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" />
          <span>99.9% uptime</span>
        </div>
      </div>
    </HeroGeometric>
  );
};

export default TestHome;
