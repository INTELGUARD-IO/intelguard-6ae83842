import { motion } from 'framer-motion';
import { Download, Filter, Target, CheckCircle, Upload } from 'lucide-react';

const steps = [
  { icon: Download, label: 'Ingest', description: '50+ sources' },
  { icon: Filter, label: 'Normalize', description: 'Dedup & format' },
  { icon: Target, label: 'Score', description: 'Confidence rating' },
  { icon: CheckCircle, label: 'Validate', description: 'Multi-vendor' },
  { icon: Upload, label: 'Publish', description: 'API & feeds' },
];

export const PipelineVisual = () => {
  return (
    <div className="relative py-12">
      <div className="flex items-center justify-between max-w-5xl mx-auto">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <div key={step.label} className="flex items-center">
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                transition={{ delay: index * 0.2 }}
                viewport={{ once: true }}
                className="relative group"
              >
                {/* Glow effect */}
                <div className="absolute inset-0 bg-primary rounded-full blur-xl opacity-0 group-hover:opacity-50 transition-opacity" />
                
                {/* Node */}
                <div className="relative bg-card border-2 border-primary/50 rounded-full p-6 hover:border-primary transition-colors">
                  <Icon className="h-8 w-8 text-primary" />
                </div>
                
                {/* Label */}
                <div className="absolute -bottom-14 left-1/2 -translate-x-1/2 text-center whitespace-nowrap">
                  <div className="text-sm font-semibold text-foreground mb-1">{step.label}</div>
                  <div className="text-xs text-body">{step.description}</div>
                </div>
              </motion.div>

              {/* Connector line */}
              {index < steps.length - 1 && (
                <motion.div
                  initial={{ scaleX: 0 }}
                  whileInView={{ scaleX: 1 }}
                  transition={{ delay: index * 0.2 + 0.1, duration: 0.3 }}
                  viewport={{ once: true }}
                  className="h-px w-24 bg-gradient-to-r from-primary/50 to-primary/20 mx-4 origin-left"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
