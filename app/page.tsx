import { Button } from "@/components/ui/button"
import { Shield, Activity, Lock, Zap } from "lucide-react"
import Link from "next/link"

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <span className="text-xl font-bold text-white">INTELGUARD</span>
          </div>
          <div className="flex gap-4">
            <Button asChild variant="ghost" className="text-slate-300 hover:text-white">
              <Link href="/auth/login">Sign In</Link>
            </Button>
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/auth/sign-up">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="container mx-auto px-4 py-24 text-center">
          <div className="mx-auto max-w-3xl">
            <h1 className="mb-6 text-5xl font-bold text-white">
              Enterprise Threat Intelligence
              <span className="block text-blue-400">Validated & Real-Time</span>
            </h1>
            <p className="mb-8 text-lg text-slate-400">
              Multi-tenant SaaS platform providing validated threat intelligence feeds from multiple sources. Built for
              MSPs and security teams.
            </p>
            <div className="flex justify-center gap-4">
              <Button asChild size="lg" className="bg-blue-600 hover:bg-blue-700">
                <Link href="/auth/sign-up">Start Free Trial</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-slate-700 text-white hover:bg-slate-800 bg-transparent"
              >
                <Link href="/auth/login">Sign In</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-16">
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-500/10">
                <Activity className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">Real-Time Feeds</h3>
              <p className="text-sm text-slate-400">
                Continuous ingestion from multiple threat intelligence sources with 30-second refresh cycles.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/10">
                <Shield className="h-6 w-6 text-green-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">Multi-Validator</h3>
              <p className="text-sm text-slate-400">
                Cross-reference indicators across 10+ validation services for maximum accuracy.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-purple-500/10">
                <Lock className="h-6 w-6 text-purple-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">Multi-Tenant</h3>
              <p className="text-sm text-slate-400">
                Secure isolation for MSPs managing multiple customer environments with RLS.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6 backdrop-blur">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/10">
                <Zap className="h-6 w-6 text-orange-400" />
              </div>
              <h3 className="mb-2 text-lg font-semibold text-white">Smart Deduplication</h3>
              <p className="text-sm text-slate-400">
                Automatic deduplication and prioritization of threat indicators across all feeds.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-900/50 py-8">
        <div className="container mx-auto px-4 text-center text-sm text-slate-400">
          <p>&copy; 2025 INTELGUARD. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
