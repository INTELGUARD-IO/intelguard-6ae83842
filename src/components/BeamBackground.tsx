import { motion } from 'framer-motion';

export const BeamBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Animated beams */}
      <motion.div
        className="absolute top-0 left-1/4 w-px h-full bg-gradient-to-b from-transparent via-primary/20 to-transparent"
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scaleY: [1, 1.2, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
      <motion.div
        className="absolute top-0 right-1/3 w-px h-full bg-gradient-to-b from-transparent via-accent/20 to-transparent"
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scaleY: [1, 1.2, 1],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 0.5,
        }}
      />
      <motion.div
        className="absolute top-0 left-2/3 w-px h-full bg-gradient-to-b from-transparent via-primary/20 to-transparent"
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scaleY: [1, 1.2, 1],
        }}
        transition={{
          duration: 3.5,
          repeat: Infinity,
          ease: "easeInOut",
          delay: 1,
        }}
      />
      
      {/* Radial glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute top-1/4 right-0 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
    </div>
  );
};
