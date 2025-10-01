import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check } from "lucide-react";

const Pricing = () => {
  const [isAnnual, setIsAnnual] = useState(false);
  
  const plans = [
    {
      name: "Individual",
      description: "For individual security professionals and small teams",
      monthlyPrice: 19,
      features: [
        "Full IPv4 & Domain feeds",
        "2 feed tokens (1 IPv4, 1 Domain)",
        "Multi-vendor validation",
        "Real-time updates",
        "Email notifications",
        "Dashboard & analytics",
        "API access",
        "Standard support",
      ],
      gradient: "from-cyber-cyan to-cyber-blue",
    },
    {
      name: "MSP",
      description: "For Managed Service Providers managing multiple clients",
      monthlyPrice: 99,
      features: [
        "Everything in Individual",
        "Unlimited customers",
        "Dedicated tokens per customer",
        "Multi-tenant dashboard",
        "Customer analytics",
        "White-label capability",
        "Priority support",
        "Custom integrations",
      ],
      gradient: "from-cyber-purple to-cyber-pink",
      popular: true,
    },
  ];
  
  const calculatePrice = (monthlyPrice: number) => {
    if (isAnnual) {
      return Math.round(monthlyPrice * 0.85); // 15% discount
    }
    return monthlyPrice;
  };
  
  return (
    <section className="py-20 px-4 relative">
      <div className="container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Simple, Transparent{" "}
            <span className="bg-gradient-accent bg-clip-text text-transparent">
              Pricing
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Choose the plan that fits your needs. Save 15% with annual billing.
          </p>
          
          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-4 mb-12">
            <span className={`text-sm ${!isAnnual ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              Monthly
            </span>
            <button
              onClick={() => setIsAnnual(!isAnnual)}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-muted hover:bg-muted/80 transition-colors"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-gradient-primary transition ${
                  isAnnual ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className={`text-sm ${isAnnual ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
              Annual <span className="text-primary text-xs">(Save 15%)</span>
            </span>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <Card 
              key={index}
              className={`relative border-2 ${
                plan.popular 
                  ? 'border-primary shadow-glow-cyan' 
                  : 'border-border/50'
              } bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-all duration-300`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <span className="bg-gradient-accent text-white text-xs font-bold px-4 py-1 rounded-full">
                    MOST POPULAR
                  </span>
                </div>
              )}
              
              <CardHeader className="text-center pb-8">
                <CardTitle className="text-2xl mb-2">{plan.name}</CardTitle>
                <CardDescription className="text-base mb-6">
                  {plan.description}
                </CardDescription>
                <div className="space-y-1">
                  <div className="flex items-baseline justify-center gap-2">
                    <span className="text-5xl font-bold">
                      €{calculatePrice(plan.monthlyPrice)}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  {isAnnual && (
                    <p className="text-sm text-muted-foreground">
                      €{calculatePrice(plan.monthlyPrice) * 12} billed annually
                    </p>
                  )}
                </div>
              </CardHeader>
              
              <CardContent className="space-y-6">
                <Button 
                  className={`w-full ${
                    plan.popular 
                      ? 'bg-gradient-accent hover:opacity-90 shadow-glow-purple' 
                      : 'bg-gradient-primary hover:opacity-90'
                  }`}
                  size="lg"
                >
                  Get Started
                </Button>
                
                <ul className="space-y-3">
                  {plan.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <p className="text-center text-sm text-muted-foreground mt-12">
          All plans include 30-day money-back guarantee. No credit card required for trial.
        </p>
      </div>
    </section>
  );
};

export default Pricing;
