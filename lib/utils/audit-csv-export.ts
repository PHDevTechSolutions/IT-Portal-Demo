/**
 * Export audit logs to CSV format
 */
export function exportAuditLogsToCSV(
  logs: Array<{
    id: string;
    source: string;
    action: string;
    actor?: { name?: string | null; email?: string | null } | null;
    resourceName?: string | null;
    resourceType?: string | null;
    module?: string | null;
    page?: string | null;
    timestamp?: { toDate?: () => Date } | null;
    affectedCount?: number;
    changes?: Record<string, { before: unknown; after: unknown }> | null;
    metadata?: Record<string, unknown> | null;
  }>,
  filename?: string
): void {
  if (logs.length === 0) {
    alert("No logs to export");
    return;
  }

  const headers = [
    "Timestamp",
    "Source",
    "Action",
    "Actor Name",
    "Actor Email",
    "Resource Name",
    "Resource Type",
    "Module",
    "Page",
    "Affected Count",
    "Changed Fields",
    "Metadata",
  ];

  const rows = logs.map((log) => {
    const timestamp = log.timestamp?.toDate
      ? log.timestamp.toDate().toISOString()
      : "—";
    const actorName = log.actor?.name || "—";
    const actorEmail = log.actor?.email || "—";
    const changedFields = log.changes
      ? Object.keys(log.changes).join("; ")
      : "—";
    const metadata = log.metadata
      ? Object.entries(log.metadata)
          .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
          .join("; ")
      : "—";

    return [
      timestamp,
      log.source,
      log.action,
      actorName,
      actorEmail,
      log.resourceName || "—",
      log.resourceType || "—",
      log.module || "—",
      log.page || "—",
      String(log.affectedCount || 1),
      changedFields,
      metadata,
    ];
  });

  const csvContent = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const str = String(cell);
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    )
    .join("\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename || `audit-logs-${new Date().toISOString().split("T")[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
