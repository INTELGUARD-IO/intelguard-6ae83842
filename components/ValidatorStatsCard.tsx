import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface ValidatorStatsCardProps {
  name: string
  status: string
  lastCheck?: string
  successRate?: number
}

export function ValidatorStatsCard({ name, status, lastCheck, successRate }: ValidatorStatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{name}</CardTitle>
        <CardDescription>Status: {status}</CardDescription>
      </CardHeader>
      <CardContent>
        {lastCheck && <p className="text-sm">Last check: {lastCheck}</p>}
        {successRate !== undefined && <p className="text-sm">Success rate: {successRate}%</p>}
      </CardContent>
    </Card>
  )
}
