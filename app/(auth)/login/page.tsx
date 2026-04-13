import { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión — Échale",
};

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-background flex">

      {/* ── Left panel (branding) — hidden on mobile ── */}
      <div className="hidden lg:flex flex-col justify-between w-[52%] px-16 py-14 relative overflow-hidden border-r border-border">

        {/* Dot-grid background */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage: "radial-gradient(circle, #C8FF00 1px, transparent 1px)",
            backgroundSize: "28px 28px",
          }}
        />

        {/* Gradient fade to black on the right edge */}
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-r from-transparent to-background" />

        {/* Brand */}
        <div className="relative z-10">
          <span className="font-display text-xl font-bold text-foreground tracking-widest">
            ÉCHALE
          </span>
        </div>

        {/* Hero copy */}
        <div className="relative z-10 space-y-6 max-w-sm">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/20 rounded-full px-3 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-accent text-xs font-sans font-medium tracking-wide">
              Panel de gestión
            </span>
          </div>

          <h2 className="font-display text-5xl font-bold text-foreground leading-[1.1] tracking-tight">
            Tu agencia,
            <br />
            <span className="text-accent">en un solo</span>
            <br />
            lugar.
          </h2>

          <p className="text-muted text-base font-sans leading-relaxed">
            Métricas, clientes y proyectos centralizados para
            tomar decisiones más rápido.
          </p>
        </div>

        {/* Bottom tagline */}
        <p className="relative z-10 text-xs text-muted font-sans">
          © {new Date().getFullYear()} Échale. Todos los derechos reservados.
        </p>
      </div>

      {/* ── Right panel (form) ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">

        {/* Mobile-only brand */}
        <div className="lg:hidden mb-10 text-center">
          <span className="font-display text-2xl font-bold text-foreground tracking-widest">
            ÉCHALE
          </span>
        </div>

        <div className="w-full max-w-sm">
          {/* Heading */}
          <div className="mb-8">
            <h1 className="font-display text-3xl font-bold text-foreground">
              Bienvenido de vuelta
            </h1>
            <p className="mt-2 text-muted text-sm font-sans">
              Ingresa tus credenciales para continuar.
            </p>
          </div>

          {/* Form card */}
          <div className="bg-surface border border-border rounded-2xl p-8">
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-xs text-muted font-sans">
            ¿Problemas para acceder?{" "}
            <a
              href="mailto:soporte@echale.mx"
              className="text-accent hover:underline transition-colors"
            >
              Contacta soporte
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
