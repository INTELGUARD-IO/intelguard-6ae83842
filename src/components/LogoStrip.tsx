import { Shield } from 'lucide-react';

const logos = [
  'Cisco',
  'Palo Alto Networks',
  'Fortinet',
  'Citrix',
  'Check Point',
  'pfSense',
];

export const LogoStrip = () => {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-8">
        {logos.map((logo) => (
          <div
            key={logo}
            className="flex items-center gap-2 px-6 py-3 opacity-50 hover:opacity-100 transition-opacity"
          >
            <Shield className="h-6 w-6" />
            <span className="text-sm font-medium">{logo}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-center text-muted-foreground italic">
        For illustration only. No endorsement implied.
      </p>
    </div>
  );
};
