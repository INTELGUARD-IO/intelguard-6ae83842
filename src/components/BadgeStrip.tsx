import comptiaCysa from '@/assets/certifications/comptia-cysa.png';
import comptiaPentest from '@/assets/certifications/comptia-pentest.png';
import comptiaCasp from '@/assets/certifications/comptia-casp.png';
import comptiaNetwork from '@/assets/certifications/comptia-network.png';
import comptiaSecurity from '@/assets/certifications/comptia-security.png';
import ciscoCcnpServiceProvider from '@/assets/certifications/cisco-ccnp-service-provider.png';
import ciscoCybersecurityAssociate from '@/assets/certifications/cisco-cybersecurity-associate.png';
import ciscoCcieSecurity from '@/assets/certifications/cisco-ccie-security.png';
import ciscoCcnpSecurity from '@/assets/certifications/cisco-ccnp-security.png';
import ciscoEthicalHackingCtf from '@/assets/certifications/cisco-ethical-hacking-ctf.png';

const certifications = [
  { name: 'CompTIA CySA+', src: comptiaCysa },
  { name: 'CompTIA PenTest+', src: comptiaPentest },
  { name: 'CompTIA CASP+', src: comptiaCasp },
  { name: 'CompTIA Network+', src: comptiaNetwork },
  { name: 'CompTIA Security+', src: comptiaSecurity },
  { name: 'Cisco CCNP Service Provider', src: ciscoCcnpServiceProvider },
  { name: 'Cisco Cybersecurity Associate', src: ciscoCybersecurityAssociate },
  { name: 'Cisco CCIE Security', src: ciscoCcieSecurity },
  { name: 'Cisco CCNP Security', src: ciscoCcnpSecurity },
  { name: 'Cisco Ethical Hacking CTF', src: ciscoEthicalHackingCtf },
];

export const BadgeStrip = () => {
  return (
    <div className="space-y-8">
      {/* Titolo principale */}
      <h3 className="text-2xl md:text-3xl font-bold text-center text-foreground">
        Intelguard: Certified expertise. Practical defense.
      </h3>
      
      {/* Griglia loghi certificazioni */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-8 max-w-6xl mx-auto items-center">
        {certifications.map((cert) => (
          <div
            key={cert.name}
            className="flex items-center justify-center px-4 py-4 opacity-80 hover:opacity-100 transition-opacity"
          >
            <img
              src={cert.src}
              alt={cert.name}
              className="h-20 w-auto object-contain"
              loading="lazy"
            />
          </div>
        ))}
      </div>
      
      {/* Sottotitolo esplicativo */}
      <p className="text-center text-base md:text-lg text-muted-foreground max-w-4xl mx-auto leading-relaxed">
        Independent, vendor-neutral skills backed by industry certifications and daily analyst validation.
      </p>
    </div>
  );
};
