import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

interface CronJobStatus {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_status: string | null;
  last_run_start: string | null;
  last_run_end: string | null;
  last_duration_seconds: number | null;
  last_error: string | null;
  next_run_estimated: string | null;
}

export const CronJobMonitor = () => {
  const { data: cronJobs, isLoading } = useQuery({
    queryKey: ["cron-job-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cron_job_status")
        .select("*")
        .order("jobid");

      if (error) throw error;
      return data as CronJobStatus[];
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  const getStatusBadge = (job: CronJobStatus) => {
    if (!job.active) {
      return <Badge variant="secondary">Inactive</Badge>;
    }
    
    if (!job.last_status) {
      return <Badge variant="outline">Never Run</Badge>;
    }

    if (job.last_status === "succeeded") {
      return <Badge variant="default" className="bg-success">Success</Badge>;
    }

    if (job.last_status === "failed") {
      return <Badge variant="destructive">Failed</Badge>;
    }

    return <Badge variant="secondary">{job.last_status}</Badge>;
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "N/A";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatTime = (timestamp: string | null) => {
    if (!timestamp) return "N/A";
    return new Date(timestamp).toLocaleString("it-IT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Cron Job Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Cron Job Monitor
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {cronJobs?.map((job) => (
            <div
              key={job.jobid}
              className="flex items-start justify-between border-b pb-4 last:border-0"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">{job.jobname}</h4>
                  {getStatusBadge(job)}
                </div>
                <p className="text-sm text-muted-foreground">
                  Schedule: <code className="text-xs bg-muted px-1 py-0.5 rounded">{job.schedule}</code>
                </p>
                {job.last_run_start && (
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Last Run: {formatTime(job.last_run_start)}</span>
                    <span>Duration: {formatDuration(job.last_duration_seconds)}</span>
                  </div>
                )}
                {job.next_run_estimated && (
                  <p className="text-xs text-muted-foreground">
                    Next Run (est.): {formatTime(job.next_run_estimated)}
                  </p>
                )}
                {job.last_error && (
                  <div className="flex items-start gap-2 mt-2">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
                    <p className="text-xs text-destructive">{job.last_error}</p>
                  </div>
                )}
              </div>
              <div className="text-right">
                {job.last_status === "succeeded" && (
                  <CheckCircle className="h-5 w-5 text-success" />
                )}
                {job.last_status === "failed" && (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
              </div>
            </div>
          ))}
          {(!cronJobs || cronJobs.length === 0) && (
            <p className="text-muted-foreground text-center py-4">
              No cron jobs found
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};