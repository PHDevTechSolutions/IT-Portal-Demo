"use client";

/**
 * PDF Export Utility for Customer Database Audit Dialog
 * 
 * Generates PDF reports from audit dialog results.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Types matching audit-dialog.tsx
interface Customer {
  id: number;
  account_reference_number: string;
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  region: string;
  type_client: string;
  referenceid: string;
  tsm: string;
  manager: string;
  status: string;
  remarks: string;
  date_created: string;
  date_updated: string;
  next_available_date?: string;
}

interface DuplicateGroup {
  id: string;
  type: "same-tsa" | "cross-tsa";
  matchReason: string;
  customers: Customer[];
}

interface AuditResult {
  duplicateGroups: DuplicateGroup[];
  missingType: Customer[];
  missingStatus: Customer[];
  allAffectedCustomers: Customer[];
  duplicateIds: Set<number>;
}

/**
 * Export audit dialog results to PDF
 */
export function exportAuditDialogToPDF(
  auditResult: AuditResult,
  allCustomers: Customer[],
  filename: string = "customer-audit-report"
): void {
  const doc = new jsPDF();
  
  // Add title
  doc.setFontSize(18);
  doc.text("Customer Database Audit Report", 14, 20);
  
  // Add summary
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 30);
  doc.text(`Total Customers Scanned: ${allCustomers.length}`, 14, 36);
  doc.text(`Total Issues Found: ${auditResult.allAffectedCustomers.length}`, 14, 42);
  
  // Add issue summary
  let yPos = 50;
  doc.setFontSize(12);
  doc.text("Issue Summary:", 14, yPos);
  yPos += 8;
  
  doc.setFontSize(10);
  doc.text(`• Same-TSA Duplicates: ${auditResult.duplicateGroups.filter(g => g.type === "same-tsa").length} groups`, 20, yPos);
  yPos += 6;
  doc.text(`• Cross-TSA Duplicates: ${auditResult.duplicateGroups.filter(g => g.type === "cross-tsa").length} groups`, 20, yPos);
  yPos += 6;
  doc.text(`• Missing Type: ${auditResult.missingType.length} customers`, 20, yPos);
  yPos += 6;
  doc.text(`• Missing Status: ${auditResult.missingStatus.length} customers`, 20, yPos);
  yPos += 10;
  
  // Add duplicate groups table if any
  if (auditResult.duplicateGroups.length > 0) {
    doc.setFontSize(12);
    doc.text("Duplicate Groups:", 14, yPos);
    yPos += 8;
    
    const duplicateData = auditResult.duplicateGroups.flatMap((group) =>
      group.customers.map((c) => [
        group.type === "same-tsa" ? "Same TSA" : "Cross TSA",
        c.company_name,
        c.contact_person || "—",
        c.email_address || "—",
        c.referenceid || "—",
        group.matchReason,
      ])
    );
    
    autoTable(doc, {
      startY: yPos,
      head: [["Type", "Company", "Contact", "Email", "TSA (RefID)", "Match Reason"]],
      body: duplicateData,
      theme: "grid",
      headStyles: {
        fillColor: [231, 76, 60],
        textColor: 255,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
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
    
    yPos = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : yPos + 50;
  }
  
  // Add missing type customers if any
  if (auditResult.missingType.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.text("Customers Missing Type:", 14, yPos);
    yPos += 8;
    
    const missingTypeData = auditResult.missingType.map((c) => [
      c.company_name,
      c.contact_person || "—",
      c.email_address || "—",
      c.status || "—",
      c.referenceid || "—",
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [["Company", "Contact", "Email", "Status", "TSA (RefID)"]],
      body: missingTypeData,
      theme: "grid",
      headStyles: {
        fillColor: [243, 156, 18],
        textColor: 255,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
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
    
    yPos = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : yPos + 50;
  }
  
  // Add missing status customers if any
  if (auditResult.missingStatus.length > 0) {
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(12);
    doc.text("Customers Missing Status:", 14, yPos);
    yPos += 8;
    
    const missingStatusData = auditResult.missingStatus.map((c) => [
      c.company_name,
      c.contact_person || "—",
      c.email_address || "—",
      c.type_client || "—",
      c.referenceid || "—",
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [["Company", "Contact", "Email", "Type", "TSA (RefID)"]],
      body: missingStatusData,
      theme: "grid",
      headStyles: {
        fillColor: [243, 156, 18],
        textColor: 255,
        fontStyle: "bold",
      },
      bodyStyles: {
        fontSize: 8,
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
  }
  
  // Save the PDF
  doc.save(`${filename}-${new Date().toISOString().split("T")[0]}.pdf`);
}
