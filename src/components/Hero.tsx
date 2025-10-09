import { Button } from "@/components/ui/button";
import { Shield, ArrowRight } from "lucide-react";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-hero opacity-50" />
      
      {/* Cyber grid effect */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(63,240,226,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(63,240,226,0.05)_1px,transparent_1px)] bg-[size:50px_50px]" />
      
      <div className="container relative z-10 mx-auto px-4 py-20">
        <div className="flex flex-col items-center text-center space-y-8 max-w-4xl mx-auto">
          {/* Logo/Icon */}
          <div className="relative">
            <div className="absolute inset-0 blur-2xl bg-primary opacity-30 rounded-full" />
            <Shield className="relative h-20 w-20 text-primary" strokeWidth={1.5} />
          </div>
          
          {/* Main heading */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight">
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              Real-Time Threat Intelligence
            </span>
            <br />
            <span className="text-foreground">You Can Trust</span>
          </h1>
          
          {/* Description */}
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl">
            Validated IPv4 and domain feeds updated continuously. 
            Protect your infrastructure with intelligence verified by multiple sources.
          </p>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 pt-4">
            <Button 
              size="lg" 
              className="bg-gradient-primary hover:opacity-90 transition-opacity text-lg px-8 shadow-glow-cyan"
            >
              Get Started <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-primary/50 hover:bg-primary/10 text-lg px-8"
            >
              View Pricing
            </Button>
          </div>
          
          {/* Trust indicators */}
          <div className="flex flex-wrap justify-center gap-8 pt-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span>Multi-vendor validation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-accent animate-pulse" />
              <span>Real-time updates</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
              <span>99.9% uptime</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Bottom fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
    </section>
  );
};

export default Hero;
