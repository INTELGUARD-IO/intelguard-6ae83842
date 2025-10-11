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
  const [scanUuid, setScanUuid] = useState<string | null>(null);

  const pollResult = async (uuid: string) => {
    const maxAttempts = 20;
    const pollInterval = 3000; // 3 seconds

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      console.log(`Polling attempt ${attempt + 1}/${maxAttempts}...`);
      
      const url = new URL(window.location.origin);
      url.pathname = '/functions/v1/urlscan-result';
      url.searchParams.set('uuid', uuid);

      const response = await fetch(url.toString(), {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
        }
      });

      const data = await response.json();

      if (data.status === 'ready') {
        return data;
      }

      if (data.status === 'failed') {
        throw new Error('Scan failed');
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Scan timeout - results not ready after 60 seconds');
  };

  const handleTest = async () => {
    if (!indicator) {
      setError("Inserisci un indicatore da testare");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setScanUuid(null);

    try {
      // Step 1: Submit scan
      const { data: submitData, error: submitError } = await supabase.functions.invoke(
        "urlscan-submit",
        {
          body: { indicator }
        }
      );

      if (submitError) {
        console.error("Submit error:", submitError);
        if (submitError.message?.includes('403') || submitError.message?.includes('authentication')) {
          setError(
            `❌ Errore di autenticazione Cloudflare (403):\n\n` +
            `Il token API non ha i permessi corretti.\n\n` +
            `Verifica che il token abbia gli scope:\n` +
            `• URL Scanner: Read\n` +
            `• URL Scanner: Write`
          );
        } else {
          setError(submitError.message || "Errore durante l'invio della scansione");
        }
        return;
      }

      if (!submitData || !submitData.uuid) {
        setError("Nessun UUID ricevuto dalla submission");
        return;
      }

      const uuid = submitData.uuid;
      setScanUuid(uuid);
      console.log(`Scan submitted with UUID: ${uuid}`);

      // Step 2: Poll for results
      const scanResult = await pollResult(uuid);
      setResult(scanResult);
      
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
                  {scanUuid ? `Polling risultati (UUID: ${scanUuid.substring(0, 8)}...)` : 'Invio scansione...'}
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
                    {result.malicious ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    Risultato Scansione
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="col-span-2">
                      <span className="font-semibold">UUID:</span> {result.uuid}
                    </div>
                    <div>
                      <span className="font-semibold">Status:</span> {result.status}
                    </div>
                    <div>
                      <span className="font-semibold">Verdict:</span> {result.verdicts}
                    </div>
                    <div>
                      <span className="font-semibold">Malicious:</span>{" "}
                      <span className={result.malicious ? "text-red-500" : "text-green-500"}>
                        {result.malicious ? "Sì" : "No"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span className="font-semibold">Final URL:</span> {result.final_url}
                    </div>
                    {result.page_title && (
                      <div className="col-span-2">
                        <span className="font-semibold">Page Title:</span> {result.page_title}
                      </div>
                    )}
                    {result.categories?.length > 0 && (
                      <div className="col-span-2">
                        <span className="font-semibold">Categories:</span>{" "}
                        {result.categories.join(", ")}
                      </div>
                    )}
                  </div>
                  <details className="mt-4">
                    <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                      Mostra JSON completo
                    </summary>
                    <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-sm mt-2">
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </details>
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
