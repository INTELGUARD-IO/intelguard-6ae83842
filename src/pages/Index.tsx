import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Shield, Eye, AlertTriangle, Clock, Zap, Target, Lock, DollarSign, CheckCircle, PlayCircle } from 'lucide-react';
import { BeamBackground } from '@/components/BeamBackground';
import { BadgeStrip } from '@/components/BadgeStrip';
import { PipelineVisual } from '@/components/PipelineVisual';
import { FeedTabs } from '@/components/FeedTabs';
import { MetricTiles } from '@/components/MetricTiles';
import { LogoStrip } from '@/components/LogoStrip';
import { CTABand } from '@/components/CTABand';
import { CodeBlock } from '@/components/CodeBlock';
import { TestimonialSection } from '@/components/TestimonialSection';
import { motion } from 'framer-motion';

const Index = () => {
  const navigate = useNavigate();

  const valuePillars = [
    {
      icon: Shield,
      title: 'Best-in-class Indicators',
      description: 'Multi-vendor validation with analyst oversight ensures maximum confidence and minimal false positives.',
    },
    {
      icon: DollarSign,
      title: 'Dynamic & Cost-efficient',
      description: 'Feed-only model eliminates per-lookup costs. Pay once, query unlimited times.',
    },
    {
      icon: Zap,
      title: 'Plug-and-Play',
      description: 'Pre-normalized formats for instant integration with firewalls, SIEM, IDS/IPS, and more.',
    },
  ];

  const problemCards = [
    {
      icon: Eye,
      title: 'Unseen Reconnaissance',
      description: 'Attackers probe your infrastructure silently, mapping vulnerabilities before you know they exist.',
    },
    {
      icon: AlertTriangle,
      title: 'Mass Exploitation Waves',
      description: 'When a zero-day drops, threat actors weaponize it in hours. Your defenses need real-time intelligence.',
    },
    {
      icon: Clock,
      title: 'Delayed Kill-Chain Response',
      description: 'Traditional threat feeds lag behind. By the time you block an IP, the damage is done.',
    },
  ];

  const capabilities = [
    { title: 'IPv4 & Domain Feeds', description: 'Validated malicious IPs and domains with confidence scores' },
    { title: 'URL Threat Intelligence', description: 'Dangerous URLs with context and malware families' },
    { title: 'Multi-Vendor Validation', description: 'Cross-referenced with 50+ threat-intel sources' },
    { title: 'Real-Time Updates', description: 'Feed refreshed every 5 minutes for maximum freshness' },
    { title: 'Historical Context', description: '15+ data points per indicator including first seen, tags, sources' },
    { title: 'MSP Multi-Tenancy', description: 'Built for managed security providers with tenant isolation' },
  ];

  const faqs = [
    {
      question: 'What makes INTELGUARD different from other threat feeds?',
      answer: 'We combine multi-vendor validation with analyst oversight, reducing false positives by 83% compared to raw feeds. Our feed-only model eliminates per-lookup costs, and we deliver fresh indicators every 5 minutes.',
    },
    {
      question: 'How quickly are new threats added to the feed?',
      answer: 'Our automated ingestion pipeline processes new indicators every 5 minutes. High-confidence threats validated by multiple sources are published in near real-time.',
    },
    {
      question: 'Do you support MSP/multi-tenant deployments?',
      answer: 'Yes! Our MSP program offers tiered discounts, tenant-level key management, and usage analytics. Contact us for MSP pricing and onboarding.',
    },
    {
      question: 'What integrations do you support?',
      answer: 'We support pfSense, OPNsense, Fortinet, Palo Alto, Check Point, Cisco, Splunk, Wazuh, Graylog, Suricata, and more. Pre-built recipes available for copy-paste integration.',
    },
    {
      question: 'Is there a free trial?',
      answer: 'Yes! We offer a reduced trial with no credit card required. The trial is for evaluation only and not intended for production use.',
    },
  ];

  const curlExample = `curl -H "X-API-Key: YOUR_KEY" \\
  https://api.intelguard.io/v1/feed/ipv4`;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 backdrop-blur-sm sticky top-0 z-50 bg-background/80">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-6 w-6 text-accent" />
            <span className="font-bold text-xl text-foreground">INTELGUARD</span>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/auth')}>
              Sign In
            </Button>
            <Button onClick={() => navigate('/auth')}>Get Started</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
        <BeamBackground />
        
        <div className="relative container mx-auto px-4 py-20 text-center z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <Badge variant="secondary" className="mb-4">
              <Shield className="h-3 w-3 mr-1" />
              Real-Time Threat Intelligence Platform
            </Badge>
            
            <h1 className="text-5xl md:text-7xl font-bold text-foreground leading-tight">
              Block threats.
              <br />
              <span className="text-transparent bg-clip-text bg-gradient-primary">
                Not your business.
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-body max-w-3xl mx-auto">
              Dynamic feeds of malicious indicators (IPs, domains, URLs) validated by analysts
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Button
                size="lg"
                className="bg-accent hover:bg-accent/90 text-white shadow-glow-accent"
                onClick={() => navigate('/auth?trial=true')}
              >
                Get Started Free
              </Button>
              <Button size="lg" variant="outline" className="gap-2">
                <PlayCircle className="h-5 w-5" />
                Watch the demo
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Reduced trial, no credit card. True Threat Feeds™.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Why INTELGUARD?
            </h2>
            <p className="text-xl text-body max-w-2xl mx-auto">
              Three pillars of superior threat intelligence
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {valuePillars.map((pillar, index) => {
              const Icon = pillar.icon;
              return (
                <motion.div
                  key={pillar.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="h-full border-border/50 hover:border-primary/30 transition-colors bg-gradient-card">
                    <CardHeader>
                      <Icon className="h-12 w-12 text-accent mb-4" />
                      <CardTitle>{pillar.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-body">
                        {pillar.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Integration Logos */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Automate your Threat Protection
            </h2>
          </div>

          <LogoStrip />
        </div>
      </section>

      {/* Problem → Outcome */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              When recon meets mass exploitation,
              <br />
              your window to act is seconds
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto mb-12">
            {problemCards.map((problem, index) => {
              const Icon = problem.icon;
              return (
                <motion.div
                  key={problem.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  viewport={{ once: true }}
                >
                  <Card className="h-full border-destructive/30 bg-destructive/5">
                    <CardHeader>
                      <Icon className="h-10 w-10 text-destructive mb-3" />
                      <CardTitle className="text-xl">{problem.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-body">
                        {problem.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-block bg-accent/10 border-2 border-accent/30 rounded-lg p-8">
              <h3 className="text-2xl font-bold text-foreground mb-3">
                <CheckCircle className="inline-block h-8 w-8 text-accent mr-2" />
                The Outcome
              </h3>
              <p className="text-lg text-body">
                Real-time validated threat intelligence that blocks attacks before they reach your infrastructure, 
                reducing alert fatigue by 83% and giving your SOC team actionable intelligence—not noise.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              How it Works
            </h2>
            <p className="text-xl text-body">
              5-stage pipeline from ingestion to publication
            </p>
          </div>

          <PipelineVisual />
        </div>
      </section>

      {/* Testimonial */}
      <TestimonialSection />

      {/* Key Capabilities */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Key Capabilities
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {capabilities.map((capability, index) => (
              <motion.div
                key={capability.title}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.05 }}
                viewport={{ once: true }}
                className="bg-card border border-border/50 rounded-lg p-6 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{capability.title}</h3>
                    <p className="text-sm text-body">{capability.description}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Feed Preview */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Live Feed Preview
            </h2>
            <p className="text-xl text-body">
              See the structure of our threat intelligence feeds
            </p>
          </div>

          <div className="max-w-3xl mx-auto">
            <FeedTabs />
          </div>
        </div>
      </section>

      {/* Metrics & Outcomes */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              By the Numbers
            </h2>
            <p className="text-xl text-body">
              Measurable outcomes that matter
            </p>
          </div>

          <MetricTiles />
        </div>
      </section>


      {/* Developer Quickstart */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Developer Quickstart
            </h2>
            <p className="text-xl text-body">
              Start blocking threats in under 5 minutes
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-6">
            <CodeBlock code={curlExample} />
            <div className="text-center">
              <Button variant="outline">
                View Integration Guide
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Band */}
      <CTABand />

      {/* Pricing */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-body">
              No per-lookup fees. Query unlimited times.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>Starter</CardTitle>
                <div className="text-3xl font-bold text-foreground">
                  €19<span className="text-lg text-muted-foreground">/mo</span>
                </div>
                <CardDescription>Perfect for small teams</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-accent" />
                  <span className="text-sm text-body">IPv4 & Domain feeds</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-accent" />
                  <span className="text-sm text-body">Real-time updates</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-accent" />
                  <span className="text-sm text-body">API access</span>
                </div>
                <Button className="w-full mt-6" onClick={() => navigate('/auth')}>
                  Get Started
                </Button>
              </CardContent>
            </Card>

            <Card className="border-accent/50 shadow-glow-accent">
              <CardHeader>
                <Badge className="mb-2 w-fit">Most Popular</Badge>
                <CardTitle>Business</CardTitle>
                <div className="text-3xl font-bold text-foreground">
                  Talk to us
                </div>
                <CardDescription>For growing organizations</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-accent" />
                  <span className="text-sm text-body">Everything in Starter</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-accent" />
                  <span className="text-sm text-body">URL threat intelligence</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-accent" />
                  <span className="text-sm text-body">Priority support</span>
                </div>
                <Button className="w-full mt-6 bg-accent hover:bg-accent/90">
                  Contact Sales
                </Button>
              </CardContent>
            </Card>

            <Card className="border-border/50">
              <CardHeader>
                <CardTitle>MSP</CardTitle>
                <div className="text-3xl font-bold text-foreground">
                  Request Access
                </div>
                <CardDescription>Multi-tenant management</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-accent" />
                  <span className="text-sm text-body">Everything in Business</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-accent" />
                  <span className="text-sm text-body">Multi-tenant model</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-accent" />
                  <span className="text-sm text-body">Tiered discounts</span>
                </div>
                <Button variant="outline" className="w-full mt-6">
                  Request MSP Access
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Frequently Asked Questions
            </h2>
          </div>

          <div className="max-w-3xl mx-auto">
            <Accordion type="single" collapsible>
              {faqs.map((faq, index) => (
                <AccordionItem key={index} value={`item-${index}`}>
                  <AccordionTrigger className="text-left text-foreground">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-body">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <BadgeStrip />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12 bg-card/30">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-6 w-6 text-accent" />
                <span className="font-bold text-xl text-foreground">INTELGUARD</span>
              </div>
              <p className="text-sm text-body">
                Real-time validated threat intelligence for modern security teams.
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-3">Product</h3>
              <ul className="space-y-2 text-sm text-body">
                <li><a href="#" className="hover:text-foreground transition-colors">Feeds</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Integrations</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">MSP Program</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-3">Resources</h3>
              <ul className="space-y-2 text-sm text-body">
                <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Status</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Changelog</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">About</a></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold text-foreground mb-3">Legal</h3>
              <ul className="space-y-2 text-sm text-body">
                <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">DPA</a></li>
                <li><a href="#" className="hover:text-foreground transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border/50 pt-8">
            <p className="text-xs text-center text-muted-foreground italic">
              All trademarks, logos and brand names are the property of their respective owners. 
              Use of these names, logos, and brands does not imply endorsement.
            </p>
            <p className="text-center text-sm text-muted-foreground mt-4">
              © 2025 INTELGUARD. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
