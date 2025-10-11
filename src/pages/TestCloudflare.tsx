import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TestCloudflare = () => {
  const [indicator, setIndicator] = useState("");
  const [kind, setKind] = useState<"domain" | "ipv4">("domain");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTest = async () => {
    if (!indicator) {
      setError("Inserisci un indicatore da testare");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        "test-cloudflare-scan",
        {
          body: { indicator, kind }
        }
      );

      if (invokeError) {
        console.error("Invoke error:", invokeError);
        setError(invokeError.message || "Errore durante la chiamata alla funzione");
        return;
      }

      // Handle HTTP errors from the edge function
      if (data && !data.success) {
        console.error("Edge function error:", data);
        
        // Handle 403 errors specifically
        if (data.status === 403) {
          setError(
            `❌ Errore di autenticazione Cloudflare (403):\n\n` +
            `Il token API non ha i permessi corretti.\n\n` +
            `Verifica che il token abbia gli scope:\n` +
            `• URL Scanner: Read\n` +
            `• URL Scanner: Write\n\n` +
            `Account ID utilizzato: ${data.requestUrl?.includes('/accounts/') ? 
              data.requestUrl.split('/accounts/')[1]?.split('/')[0] : 'N/A'}`
          );
        } else {
          setError(data.error || "Errore sconosciuto dalla scansione");
        }
        setResult(data);
        return;
      }
      
      console.log("Scan result:", data);
      setResult(data);
    } catch (err: any) {
      console.error("Errore durante la scansione:", err);
      setError(err.message || "Errore durante la scansione Cloudflare");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-accent" />
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-primary">
            Cloudflare URL Scanner Test
          </h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Test Cloudflare URL Scanner</CardTitle>
            <CardDescription>
              Testa la funzionalità di scansione Cloudflare per domini o indirizzi IP
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo di indicatore</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="kind"
                    value="domain"
                    checked={kind === "domain"}
                    onChange={() => setKind("domain")}
                    className="cursor-pointer"
                  />
                  <span>Dominio</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="kind"
                    value="ipv4"
                    checked={kind === "ipv4"}
                    onChange={() => setKind("ipv4")}
                    className="cursor-pointer"
                  />
                  <span>IPv4</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Indicatore da testare
              </label>
              <Input
                type="text"
                placeholder={kind === "domain" ? "esempio.com" : "192.168.1.1"}
                value={indicator}
                onChange={(e) => setIndicator(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleTest()}
              />
            </div>

            <Button
              onClick={handleTest}
              disabled={loading || !indicator}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Scansione in corso...
                </>
              ) : (
                <>
                  <Shield className="mr-2 h-4 w-4" />
                  Avvia Scansione
                </>
              )}
            </Button>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {result && (
              <Card className="border-accent/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {result.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    )}
                    Risultato Scansione
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-lg overflow-auto text-sm">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Questa funzione testa l'integrazione con Cloudflare URL Scanner v2</p>
            <p>• Usa un Account API Token (non User token)</p>
            <p>• Il token deve avere gli scope: URL Scanner Read + Write</p>
            <p>• Endpoint: POST /accounts/ACCOUNT_ID/urlscanner/v2/scan</p>
            <p>• La scansione può richiedere fino a 30 secondi</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TestCloudflare;
