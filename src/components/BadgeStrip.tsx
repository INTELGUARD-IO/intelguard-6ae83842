import intelguardCysa from '@/assets/certifications/intelguard-cysa.png';
import intelguardPentest from '@/assets/certifications/intelguard-pentest.png';
import intelguardNetwork from '@/assets/certifications/intelguard-network.png';
import intelguardCasp from '@/assets/certifications/intelguard-casp.png';
import intelguardSecurity from '@/assets/certifications/intelguard-security.png';
import intelguardCcnpSecurity from '@/assets/certifications/intelguard-ccnp-security.png';
import intelguardCcie from '@/assets/certifications/intelguard-ccie.png';
import intelguardCybersecurityAssociate from '@/assets/certifications/intelguard-cybersecurity-associate.png';
import intelguardCcnpServiceProvider from '@/assets/certifications/intelguard-ccnp-service-provider.png';

const certifications = [
  { name: 'CompTIA CySA+', src: intelguardCysa },
  { name: 'CompTIA PenTest+', src: intelguardPentest },
  { name: 'CompTIA Network+', src: intelguardNetwork },
  { name: 'CompTIA CASP+', src: intelguardCasp },
  { name: 'CompTIA Security+', src: intelguardSecurity },
  { name: 'Cisco CCNP Security', src: intelguardCcnpSecurity },
  { name: 'Cisco CCIE Security', src: intelguardCcie },
  { name: 'Cisco Cybersecurity Associate', src: intelguardCybersecurityAssociate },
  { name: 'Cisco CCNP Service Provider', src: intelguardCcnpServiceProvider },
];

export const BadgeStrip = () => {
  return (
    <div className="space-y-8">
      {/* Titolo principale */}
      <h3 className="text-2xl md:text-3xl font-bold text-center text-foreground">
        Intelguard: Certified expertise. Practical defense.
      </h3>
      
      {/* Griglia loghi certificazioni */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 max-w-6xl mx-auto place-items-center">
        {certifications.map((cert) => (
          <div
            key={cert.name}
            className="flex items-center justify-center w-full min-h-[140px] px-6 py-6"
          >
            <img
              src={cert.src}
              alt={cert.name}
              className="h-20 w-auto object-contain max-w-full"
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
