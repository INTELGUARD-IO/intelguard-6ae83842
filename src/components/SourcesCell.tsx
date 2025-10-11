import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

interface SourcesCellProps {
  sources?: string[];
  count?: number;
}

export function SourcesCell({ sources, count }: SourcesCellProps) {
  if (!sources || sources.length === 0) {
    return <Badge variant="secondary">0</Badge>;
  }

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Badge variant="secondary" className="cursor-help">
          {count || sources.length}
        </Badge>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Threat Intelligence Sources</h4>
          <div className="space-y-1 max-h-60 overflow-y-auto">
            {sources.map((source, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs">
                {source.startsWith('http') ? (
                  <a 
                    href={source} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {new URL(source).hostname}
                  </a>
                ) : (
                  <span className="text-muted-foreground">{source}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
