import { Badge } from "@/components/ui/badge"

interface DomainValidatorStatusProps {
  validator: string
  status: "active" | "inactive" | "error"
}

export function DomainValidatorStatus({ validator, status }: DomainValidatorStatusProps) {
  return (
    <div className="flex items-center gap-2">
      <span>{validator}</span>
      <Badge variant={status === "active" ? "default" : "destructive"}>{status}</Badge>
    </div>
  )
}
