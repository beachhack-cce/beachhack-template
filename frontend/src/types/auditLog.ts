export interface AuditLogEntry {
  id: string;
  gateway: string;
  status: "Success" | "Failed" | "Retracked";
  latency: number | null;
  timestamp: string;
}
