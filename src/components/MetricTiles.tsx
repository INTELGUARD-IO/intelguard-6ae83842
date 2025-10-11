import { motion } from 'framer-motion';
import { TrendingDown, Zap, Shield, Globe, Link as LinkIcon, Users } from 'lucide-react';

const metrics = [
  {
    icon: Zap,
    value: '< 5 min',
    label: 'Feed Freshness',
    description: 'Real-time updates',
  },
  {
    icon: TrendingDown,
    value: '83%',
    label: 'Noise Reduction',
    description: 'vs. raw feeds',
  },
  {
    icon: Shield,
    value: '< 0.5%',
    label: 'False-Positive Rate',
    description: 'Multi-vendor validated',
  },
  {
    icon: Globe,
    value: '50+',
    label: 'Coverage',
    description: 'Threat-intel sources',
  },
  {
    icon: LinkIcon,
    value: '15+',
    label: 'Context Links',
    description: 'Per indicator',
  },
  {
    icon: Users,
    value: '100+',
    label: 'MSP Tenants',
    description: 'Multi-tenant ready',
  },
];

export const MetricTiles = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {metrics.map((metric, index) => {
        const Icon = metric.icon;
        return (
          <motion.div
            key={metric.label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            viewport={{ once: true }}
            className="relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10 rounded-lg blur-xl group-hover:blur-2xl transition-all opacity-0 group-hover:opacity-100" />
            <div className="relative bg-card border border-border/50 rounded-lg p-6 hover:border-primary/30 transition-colors">
              <Icon className="h-8 w-8 text-primary mb-3" />
              <div className="text-3xl font-bold text-foreground mb-1">{metric.value}</div>
              <div className="text-sm font-medium text-foreground mb-1">{metric.label}</div>
              <div className="text-xs text-body">{metric.description}</div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
