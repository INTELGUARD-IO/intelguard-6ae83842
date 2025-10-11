import g2Fall2025Leader from '@/assets/awards/g2-fall-2025-leader.png';
import g2AsiaPacificHighPerformer from '@/assets/awards/g2-asia-pacific-high-performer.png';
import g2AsiaPacificWinter2025 from '@/assets/awards/g2-asia-pacific-winter-2025.png';

const awards = [
  { name: 'G2 Fall 2025 Leader', src: g2Fall2025Leader },
  { name: 'G2 Asia Pacific High Performer', src: g2AsiaPacificHighPerformer },
  { name: 'G2 Asia Pacific Winter 2025', src: g2AsiaPacificWinter2025 },
];

export const AwardsStrip = () => {
  return (
    <section className="py-16 px-4">
      <div className="max-w-7xl mx-auto text-center space-y-12">
        <h2 className="text-3xl md:text-4xl font-bold">
          Recognized by practitioners. Built for defenders.
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto items-center">
          {awards.map((award) => (
            <div
              key={award.name}
              className="flex items-center justify-center px-4 py-6 hover:scale-105 transition-transform"
            >
              <img
                src={award.src}
                alt={award.name}
                className="h-48 w-auto object-contain"
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
