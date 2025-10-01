import { Shield, Zap, Lock, BarChart3, RefreshCw, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const features = [
  {
    icon: Shield,
    title: "Multi-Vendor Validation",
    description: "Every indicator validated by AbuseIPDB, VirusTotal, and NeutrinoAPI for maximum accuracy.",
    gradient: "from-cyber-cyan to-cyber-blue",
  },
  {
    icon: RefreshCw,
    title: "Real-Time Updates",
    description: "Continuous ingestion from 15+ premium threat sources with hourly validation cycles.",
    gradient: "from-cyber-blue to-cyber-purple",
  },
  {
    icon: Zap,
    title: "Lightning Fast API",
    description: "Feed delivery in milliseconds with global CDN and intelligent caching.",
    gradient: "from-cyber-purple to-cyber-pink",
  },
  {
    icon: Lock,
    title: "Enterprise Security",
    description: "Token-based authentication, rate limiting, and comprehensive audit logging.",
    gradient: "from-cyber-pink to-cyber-cyan",
  },
  {
    icon: BarChart3,
    title: "Detailed Analytics",
    description: "Track feed usage, validation metrics, and threat distribution in real-time.",
    gradient: "from-cyber-cyan to-cyber-purple",
  },
  {
    icon: Users,
    title: "MSP Multi-Tenant",
    description: "Manage multiple clients with isolated feeds and dedicated tokens per customer.",
    gradient: "from-cyber-purple to-cyber-blue",
  },
];

const Features = () => {
  return (
    <section className="py-20 px-4 relative">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            <span className="bg-gradient-primary bg-clip-text text-transparent">
              Enterprise-Grade
            </span>{" "}
            Threat Intelligence
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Built for security teams who demand accuracy, speed, and reliability
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={index} 
                className="border-border/50 bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300 group"
              >
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
