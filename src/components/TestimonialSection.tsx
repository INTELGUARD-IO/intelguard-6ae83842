import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';

export function TestimonialSection() {
  return (
    <section className="py-20 bg-card/30">
      <div className="container mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          viewport={{ once: true }}
          className="max-w-5xl mx-auto"
        >
          <Card className="border-border/50 bg-card">
            <CardContent className="p-8 md:p-12 space-y-6">
              {/* Heading principale */}
              <h3 className="text-3xl md:text-5xl font-bold text-foreground leading-tight">
                "A firewall is not enough."
              </h3>
              
              {/* Quote corpo */}
              <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
                Perimeter controls stop packets, not campaigns. We needed validated, real-time indicators that move faster than exploit waves. With INTELGUARD, we auto-block C2, proxies and scanners in minutes while cutting false positives, so our analysts focus on real threats—not noise.
              </p>
              
              {/* Attribution footer */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pt-4 border-t border-border/30">
                <span className="text-sm font-medium text-muted-foreground">
                  Financial - NYSE Corporation
                </span>
                <span className="text-sm font-medium text-foreground">
                  A. C., CISO
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
