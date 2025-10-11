import { Link } from "react-router-dom";

export const IntelguardLogo = () => {
  return (
    <Link
      to="/"
      className="inline-block transition-transform hover:scale-105"
    >
      <span className="font-space text-2xl md:text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
        INTELGUARD
      </span>
    </Link>
  );
};
