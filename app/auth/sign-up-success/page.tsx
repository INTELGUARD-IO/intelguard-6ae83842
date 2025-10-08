import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Shield, Mail } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">INTELGUARD</h1>
        </div>

        <Card className="border-slate-800 bg-slate-900/50 backdrop-blur">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
              <Mail className="h-6 w-6 text-green-400" />
            </div>
            <CardTitle className="text-2xl text-white">Check Your Email</CardTitle>
            <CardDescription className="text-slate-400">We&apos;ve sent you a confirmation link</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-slate-300">
              Please check your email and click the confirmation link to activate your INTELGUARD account.
            </p>
            <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-4">
              <p className="text-xs text-blue-300">
                <strong>Note:</strong> The confirmation link will expire in 24 hours. If you don&apos;t see the email,
                check your spam folder.
              </p>
            </div>
            <Button asChild className="w-full bg-blue-600 hover:bg-blue-700">
              <Link href="/auth/login">Return to Sign In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
