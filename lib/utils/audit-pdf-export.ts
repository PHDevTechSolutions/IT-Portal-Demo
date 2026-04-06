"use client";

/**
 * PDF Export Utility for Audit Logs
 * 
 * Generates PDF reports from audit log data using jsPDF and jspdf-autotable.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Audit log entry interface
interface AuditLogEntry {
  id: string;
  action: string;
  customerName?: string | null;
  customerId?: string | null;
  performedBy?: string | null;
  performedByRole?: string | null;
  timestamp?: { toDate: () => Date } | Date | null;
  changes?: Record<string, { before: unknown; after: unknown }> | null;
  transfer?: {
    tsa?: { fromName?: string | null; toName?: string | null } | null;
    tsm?: { fromName?: string | null; toName?: string | null } | null;
    manager?: { fromName?: string | null; toName?: string | null } | null;
  } | null;
  affectedCount?: number;
  auditStatus?: string | null;
  auditRemarks?: string | null;
}

/**
 * Export audit logs to PDF
 */
export function exportAuditLogsToPDF(
  logs: AuditLogEntry[],
  filename: string = "audit-logs-report"
): void {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text("Audit Logs Report", 14, 20);
  
  // Add timestamp
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
  doc.text(`Total Records: ${logs.length}`, 14, 36);
  
  // Prepare table data
  const tableData = logs.map((log) => {
    const timestamp = log.timestamp
      ? typeof log.timestamp === "object" && "toDate" in log.timestamp
        ? log.timestamp.toDate().toLocaleString()
        : new Date(log.timestamp).toLocaleString()
      : "N/A";
    
    const details = formatAuditDetails(log);
    
    return [
      log.action?.toUpperCase() || "N/A",
      log.customerName || log.customerId || "N/A",
      log.performedBy || "N/A",
      log.performedByRole || "N/A",
      timestamp,
      details,
    ];
  });
  
  // Add table
  autoTable(doc, {
    startY: 45,
    head: [["Action", "Customer", "Performed By", "Role", "Timestamp", "Details"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 35 },
      2: { cellWidth: 30 },
      3: { cellWidth: 25 },
      4: { cellWidth: 35 },
      5: { cellWidth: "auto" },
    },
    styles: {
      overflow: "linebreak",
      cellPadding: 2,
    },
    didDrawPage: (data: any) => {
      // Add footer with page number
      doc.setFontSize(8);
      doc.text(
        `Page ${data.pageNumber}`,
        data.settings.margin.left,
        doc.internal.pageSize.height - 10
      );
    },
  });
  
  // Save the PDF
  doc.save(`${filename}-${new Date().toISOString().split("T")[0]}.pdf`);
}

/**
 * Format audit details for display
 */
function formatAuditDetails(log: AuditLogEntry): string {
  const parts: string[] = [];
  
  // Add affected count if more than 1
  if (log.affectedCount && log.affectedCount > 1) {
    parts.push(`Bulk: ${log.affectedCount} records`);
  }
  
  // Add transfer details
  if (log.transfer) {
    const transfers: string[] = [];
    if (log.transfer.tsa?.toName) {
      transfers.push(`TSA: ${log.transfer.tsa.fromName || "-"} → ${log.transfer.tsa.toName}`);
    }
    if (log.transfer.tsm?.toName) {
      transfers.push(`TSM: ${log.transfer.tsm.fromName || "-"} → ${log.transfer.tsm.toName}`);
    }
    if (log.transfer.manager?.toName) {
      transfers.push(`Manager: ${log.transfer.manager.fromName || "-"} → ${log.transfer.manager.toName}`);
    }
    if (transfers.length > 0) {
      parts.push(transfers.join("; "));
    }
  }
  
  // Add changes summary
  if (log.changes && Object.keys(log.changes).length > 0) {
    const changeKeys = Object.keys(log.changes);
    parts.push(`Changes: ${changeKeys.join(", ")}`);
  }
  
  // Add audit status
  if (log.auditStatus) {
    parts.push(`Status: ${log.auditStatus}`);
  }
  
  // Add remarks
  if (log.auditRemarks) {
    parts.push(`Remarks: ${log.auditRemarks}`);
  }
  
  return parts.join(" | ") || "No additional details";
}

/**
 * Export filtered audit logs to PDF
 */
export function exportFilteredAuditLogsToPDF(
  logs: AuditLogEntry[],
  filters: { action?: string; searchQuery?: string; dateRange?: string },
  filename: string = "filtered-audit-logs"
): void {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text("Filtered Audit Logs Report", 14, 20);
  
  // Add timestamp and filters
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
  doc.text(`Total Records: ${logs.length}`, 14, 36);
  
  // Add filter information
  let yPos = 42;
  if (filters.action || filters.searchQuery || filters.dateRange) {
    doc.text("Filters Applied:", 14, yPos);
    yPos += 6;
    
    if (filters.action) {
      doc.text(`- Action: ${filters.action}`, 20, yPos);
      yPos += 5;
    }
    if (filters.searchQuery) {
      doc.text(`- Search: ${filters.searchQuery}`, 20, yPos);
      yPos += 5;
    }
    if (filters.dateRange) {
      doc.text(`- Date Range: ${filters.dateRange}`, 20, yPos);
      yPos += 5;
    }
    yPos += 5;
  }
  
  // Prepare table data
  const tableData = logs.map((log) => {
    const timestamp = log.timestamp
      ? typeof log.timestamp === "object" && "toDate" in log.timestamp
        ? log.timestamp.toDate().toLocaleString()
        : new Date(log.timestamp).toLocaleString()
      : "N/A";
    
    const details = formatAuditDetails(log);
    
    return [
      log.action?.toUpperCase() || "N/A",
      log.customerName || log.customerId || "N/A",
      log.performedBy || "N/A",
      log.performedByRole || "N/A",
      timestamp,
      details,
    ];
  });
  
  // Add table
  autoTable(doc, {
    startY: yPos,
    head: [["Action", "Customer", "Performed By", "Role", "Timestamp", "Details"]],
    body: tableData,
    theme: "grid",
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: "bold",
    },
    bodyStyles: {
      fontSize: 9,
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 35 },
      2: { cellWidth: 30 },
      3: { cellWidth: 25 },
      4: { cellWidth: 35 },
      5: { cellWidth: "auto" },
    },
    styles: {
      overflow: "linebreak",
      cellPadding: 2,
    },
    didDrawPage: (data: any) => {
      doc.setFontSize(8);
      doc.text(
        `Page ${data.pageNumber}`,
        data.settings.margin.left,
        doc.internal.pageSize.height - 10
      );
    },
  });
  
  // Save the PDF
  const filterSuffix = filters.action ? `-${filters.action}` : "";
  doc.save(`${filename}${filterSuffix}-${new Date().toISOString().split("T")[0]}.pdf`);
}
