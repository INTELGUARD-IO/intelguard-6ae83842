import { Link } from "react-router-dom";

export const IntelguardLogo = () => {
  return (
    <Link
      to="/"
      className="group inline-flex items-center gap-2 transition-all hover:scale-105"
    >
      <span className="font-space text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent transition-all group-hover:shadow-glow-primary">
        INTEL
      </span>
      <span className="text-2xl md:text-3xl text-muted-foreground/40 font-light">
        |
      </span>
      <span className="font-space text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent transition-all group-hover:shadow-glow-primary">
        GUARD
      </span>
    </Link>
  );
};
