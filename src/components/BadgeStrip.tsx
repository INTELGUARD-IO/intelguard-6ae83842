import { Shield } from 'lucide-react';

const badges = [
  'Cisco Certified',
  'Sophos Partner',
  'CompTIA Network+',
  'CompTIA Security+',
  'Ethical Hacker',
  'G2 Rated',
  'Gartner PI',
];

export const BadgeStrip = () => {
  return (
    <div className="flex flex-wrap items-center justify-center gap-6 opacity-60">
      {badges.map((badge) => (
        <div
          key={badge}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/50 border border-border/30 hover:border-primary/30 transition-colors"
        >
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-sm text-muted-foreground">{badge}</span>
        </div>
      ))}
    </div>
  );
};
