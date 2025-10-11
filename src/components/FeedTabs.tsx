import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CodeBlock } from './CodeBlock';

const ipExample = `{
  "indicator": "192.0.2.1",
  "type": "ipv4",
  "confidence": 95,
  "threat_type": "malware_c2",
  "first_seen": "2025-01-15T10:30:00Z",
  "tags": ["botnet", "trojan"],
  "sources": 5
}`;

const domainExample = `{
  "indicator": "malicious-example.com",
  "type": "domain",
  "confidence": 92,
  "threat_type": "phishing",
  "first_seen": "2025-01-14T08:15:00Z",
  "tags": ["phishing", "credential_theft"],
  "sources": 3
}`;

const urlExample = `{
  "indicator": "https://bad-example.com/payload.exe",
  "type": "url",
  "confidence": 98,
  "threat_type": "malware_distribution",
  "first_seen": "2025-01-16T14:20:00Z",
  "tags": ["ransomware", "dropper"],
  "sources": 7
}`;

export const FeedTabs = () => {
  return (
    <div className="relative">
      <div className="absolute -top-2 -right-2 z-10 bg-accent/20 text-accent text-xs px-3 py-1 rounded-full border border-accent/30">
        DEMO — not for production use
      </div>
      <Tabs defaultValue="ip" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-card border border-border/50">
          <TabsTrigger value="ip">IPv4</TabsTrigger>
          <TabsTrigger value="domain">Domains</TabsTrigger>
          <TabsTrigger value="url">URLs</TabsTrigger>
        </TabsList>
        <TabsContent value="ip" className="mt-4">
          <CodeBlock code={ipExample} language="json" />
        </TabsContent>
        <TabsContent value="domain" className="mt-4">
          <CodeBlock code={domainExample} language="json" />
        </TabsContent>
        <TabsContent value="url" className="mt-4">
          <CodeBlock code={urlExample} language="json" />
        </TabsContent>
      </Tabs>
    </div>
  );
};
