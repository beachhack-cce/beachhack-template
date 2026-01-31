import type { AuditLogEntry } from "../types/auditLog";
import styles from "./AuditLogs.module.css";

const mockLogs: AuditLogEntry[] = [
  { id: "id_a7f2", gateway: "Stripe", status: "Success", latency: 118, timestamp: "2025-01-31 14:32:01" },
  { id: "id_b1c9", gateway: "Razorpay", status: "Failed", latency: 502, timestamp: "2025-01-31 14:31:58" },
  { id: "id_b1c9", gateway: "Stripe", status: "Retracked", latency: 125, timestamp: "2025-01-31 14:31:59" },
  { id: "id_d4e0", gateway: "Stripe", status: "Success", latency: 95, timestamp: "2025-01-31 14:28:12" },
  { id: "id_f6g1", gateway: "PayPal", status: "Failed", latency: null, timestamp: "2025-01-31 14:25:44" },
  { id: "id_f6g1", gateway: "Razorpay", status: "Retracked", latency: 410, timestamp: "2025-01-31 14:25:46" },
  { id: "id_h8i2", gateway: "Razorpay", status: "Success", latency: 380, timestamp: "2025-01-31 14:22:03" },
  { id: "id_j0k3", gateway: "Stripe", status: "Success", latency: 132, timestamp: "2025-01-31 14:18:55" },
];

const AuditLogs: React.FC = () => {
  return (
    <div className={styles.wrapper}>
      <header className={styles.header}>
        <h1 className={styles.title}>Audit logs</h1>
      </header>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Gateway</th>
              <th>Status</th>
              <th>Latency</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {mockLogs.map((row) => (
              <tr key={`${row.id}-${row.gateway}-${row.timestamp}`}>
                <td className={styles.id}>{row.id}</td>
                <td>{row.gateway}</td>
                <td>
                  <span className={`${styles.status} ${styles[row.status.toLowerCase()]}`}>
                    {row.status}
                  </span>
                </td>
                <td>{row.latency !== null ? `${row.latency} ms` : "—"}</td>
                <td className={styles.timestamp}>{row.timestamp}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogs;
