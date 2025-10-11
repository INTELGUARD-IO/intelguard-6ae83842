import mitrelogo from '@/assets/mitre-logo.png';
import sophosLogo from '@/assets/sophos-logo.png';
import ciscoLogo from '@/assets/cisco-logo.png';
import paloaltoLogo from '@/assets/paloalto-logo.png';
import cortexLogo from '@/assets/cortex-logo.png';
import checkpointLogo from '@/assets/checkpoint-logo.png';

const logos = [
  { name: 'MITRE ATT&CK', src: mitrelogo },
  { name: 'Sophos', src: sophosLogo },
  { name: 'Cisco', src: ciscoLogo },
  { name: 'Palo Alto Networks', src: paloaltoLogo },
  { name: 'Cortex', src: cortexLogo },
  { name: 'Check Point', src: checkpointLogo },
];

export const LogoStrip = () => {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 max-w-6xl mx-auto items-center">
        {logos.map((logo) => (
          <div
            key={logo.name}
            className="flex items-center justify-center px-4 py-6 opacity-70 hover:opacity-100 transition-opacity"
          >
            <img
              src={logo.src}
              alt={logo.name}
              className="h-12 w-auto object-contain"
            />
          </div>
        ))}
      </div>
      <p className="text-xs text-center text-muted-foreground italic">
        For illustration only. No endorsement implied.
      </p>
    </div>
  );
};
