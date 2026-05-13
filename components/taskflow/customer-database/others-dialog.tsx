"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import * as ExcelJS from "exceljs";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import { Loader2, Upload } from "lucide-react";

type ComboOption = {
  value: string;
  label: string;
};

type UploadRow = {
  company_name: string;
  contact_person: string;
  contact_number: string;
  email_address: string;
  address: string;
  delivery_address: string;
  type_client: string;
};

type MatchedRecord = UploadRow & {
  id: number;
  status: string;
  referenceid: string;
  tsm: string;
  manager: string;
};

type UploadDisplayRow = {
  rowIndex: number;
  source: UploadRow;
  matched: boolean;
  matchedAccountIds: number[];
};

interface OthersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  setAccountsAction?: (fn: (prev: any[]) => any[]) => void;
}

const REQUIRED_FIELDS: (keyof UploadRow)[] = [
  "company_name",
  "contact_person",
  "contact_number",
  "email_address",
  "address",
  "delivery_address",
  "type_client",
];

const HEADER_ALIASES: Record<keyof UploadRow, string[]> = {
  company_name: ["company_name", "companyname", "company", "company name"],
  contact_person: ["contact_person", "contactperson", "contact person"],
  contact_number: [
    "contact_number",
    "contactnumber",
    "contact no",
    "contact_no",
    "phone",
    "mobile",
  ],
  email_address: ["email_address", "emailaddress", "email address", "email"],
  address: ["address", "billing address", "office address"],
  delivery_address: [
    "delivery_address",
    "deliveryaddress",
    "delivery address",
    "shipping address",
    "ship address",
  ],
  type_client: [
    "type_client",
    "typeclient",
    "type client",
    "type of client",
    "client type",
  ],
};

const normalizeHeader = (value: string): string =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");

const cellToText = (value: ExcelJS.CellValue): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number") return String(value).trim();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text.trim();
    if (
      "richText" in value &&
      Array.isArray(value.richText)
    ) {
      return value.richText.map((t) => t.text || "").join("").trim();
    }
    if ("result" in value && value.result !== undefined && value.result !== null) {
      return String(value.result).trim();
    }
  }
  return String(value).trim();
};

const toKey = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

async function parseExcel(file: File): Promise<UploadRow[]> {
  const reader = new FileReader();

  return new Promise<UploadRow[]>((resolve, reject) => {
    reader.onload = async (event) => {
      try {
        const data = event.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(data);
        const worksheet = workbook.worksheets[0];

        if (!worksheet) {
          reject(new Error("No worksheet found in the file."));
          return;
        }

        const headerRow = worksheet.getRow(1);
        const fieldColumnIndex: Partial<Record<keyof UploadRow, number>> = {};

        for (let col = 1; col <= headerRow.cellCount; col += 1) {
          const rawHeader = cellToText(headerRow.getCell(col).value);
          const normalized = normalizeHeader(rawHeader);
          if (!normalized) continue;

          for (const field of REQUIRED_FIELDS) {
            const aliases = HEADER_ALIASES[field].map(normalizeHeader);
            if (aliases.includes(normalized)) {
              fieldColumnIndex[field] = col;
              break;
            }
          }
        }

        const missingHeaders = REQUIRED_FIELDS.filter((f) => !fieldColumnIndex[f]);
        if (missingHeaders.length > 0) {
          reject(
            new Error(
              `Missing required header(s): ${missingHeaders.join(", ")}`,
            ),
          );
          return;
        }

        const parsedRows: UploadRow[] = [];
        for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
          const row = worksheet.getRow(rowIndex);
          const parsed: UploadRow = {
            company_name: cellToText(row.getCell(fieldColumnIndex.company_name!).value),
            contact_person: cellToText(row.getCell(fieldColumnIndex.contact_person!).value),
            contact_number: cellToText(row.getCell(fieldColumnIndex.contact_number!).value),
            email_address: cellToText(row.getCell(fieldColumnIndex.email_address!).value),
            address: cellToText(row.getCell(fieldColumnIndex.address!).value),
            delivery_address: cellToText(row.getCell(fieldColumnIndex.delivery_address!).value),
            type_client: cellToText(row.getCell(fieldColumnIndex.type_client!).value),
          };

          const hasData = Object.values(parsed).some((value) => value.trim().length > 0);
          if (hasData) {
            parsedRows.push(parsed);
          }
        }

        resolve(parsedRows);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsArrayBuffer(file);
  });
}

export function OthersDialog({
  open,
  onOpenChange,
  setAccountsAction,
}: OthersDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [tsas, setTsas] = useState<ComboOption[]>([]);
  const [tsms, setTsms] = useState<ComboOption[]>([]);
  const [managers, setManagers] = useState<ComboOption[]>([]);

  const [tsaSelection, setTsaSelection] = useState<string>("");
  const [tsmSelection, setTsmSelection] = useState<string>("");
  const [managerSelection, setManagerSelection] = useState<string>("");

  const [fileName, setFileName] = useState("");
  const [isMatching, setIsMatching] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [matchedRowsCount, setMatchedRowsCount] = useState(0);
  const [unmatchedRowsCount, setUnmatchedRowsCount] = useState(0);
  const [uploadRows, setUploadRows] = useState<UploadDisplayRow[]>([]);
  const [matchedRecords, setMatchedRecords] = useState<MatchedRecord[]>([]);
  const [selectedRowIndexes, setSelectedRowIndexes] = useState<Set<number>>(
    new Set(),
  );

  const selectableRowIndexes = useMemo(
    () =>
      uploadRows
        .filter((row) => row.matched && row.matchedAccountIds.length > 0)
        .map((row) => row.rowIndex),
    [uploadRows],
  );

  const matchedRecordMap = useMemo(
    () => new Map(matchedRecords.map((record) => [record.id, record])),
    [matchedRecords],
  );

  const selectedTransferIds = useMemo(() => {
    const ids = new Set<number>();
    for (const row of uploadRows) {
      if (!selectedRowIndexes.has(row.rowIndex)) continue;
      for (const accountId of row.matchedAccountIds) ids.add(accountId);
    }
    return ids;
  }, [selectedRowIndexes, uploadRows]);

  const selectedRows = useMemo(
    () => uploadRows.filter((row) => selectedRowIndexes.has(row.rowIndex)),
    [uploadRows, selectedRowIndexes],
  );

  const allChecked = useMemo(
    () =>
      uploadRows.length > 0 &&
      uploadRows.every((row) => selectedRowIndexes.has(row.rowIndex)),
    [uploadRows, selectedRowIndexes],
  );

  useEffect(() => {
    if (!open) return;
    const fetchDropdowns = async () => {
      try {
        const [tsaRes, tsmRes, managerRes] = await Promise.all([
          fetch("/api/UserManagement/FetchTSA?Role=Territory Sales Associate"),
          fetch("/api/UserManagement/FetchTSM?Role=Territory Sales Manager"),
          fetch("/api/UserManagement/FetchManager?Role=Manager"),
        ]);

        const [tsaData, tsmData, managerData] = await Promise.all([
          tsaRes.ok ? tsaRes.json() : [],
          tsmRes.ok ? tsmRes.json() : [],
          managerRes.ok ? managerRes.json() : [],
        ]);

        setTsas(
          (Array.isArray(tsaData) ? tsaData : []).map((u: any) => ({
            label: `${u.Firstname} ${u.Lastname}`,
            value: u.ReferenceID,
          })),
        );
        setTsms(
          (Array.isArray(tsmData) ? tsmData : []).map((u: any) => ({
            label: `${u.Firstname} ${u.Lastname}`,
            value: u.ReferenceID,
          })),
        );
        setManagers(
          (Array.isArray(managerData) ? managerData : []).map((u: any) => ({
            label: `${u.Firstname} ${u.Lastname}`,
            value: u.ReferenceID,
          })),
        );
      } catch {
        toast.error("Failed to fetch TSA/TSM/Manager options.");
      }
    };

    fetchDropdowns();
  }, [open]);

  const resetMatchedData = () => {
    setFileName("");
    setMatchedRowsCount(0);
    setUnmatchedRowsCount(0);
    setUploadRows([]);
    setMatchedRecords([]);
    setSelectedRowIndexes(new Set());
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleFilePick = async (file: File) => {
    setIsMatching(true);
    setFileName(file.name);
    setMatchedRowsCount(0);
    setUnmatchedRowsCount(0);
    setUploadRows([]);
    setMatchedRecords([]);
    setSelectedRowIndexes(new Set());

    try {
      const parsedRows = await parseExcel(file);
      if (parsedRows.length === 0) {
        toast.error("No valid rows found in the uploaded file.");
        return;
      }

      const res = await fetch(
        "/api/Data/Applications/Taskflow/CustomerDatabase/UploadMatch",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: parsedRows }),
        },
      );
      const result = await res.json();
      if (!res.ok || !result?.success) {
        throw new Error(result?.error || "Failed to match records.");
      }

      const records = (Array.isArray(result.matchedRecords)
        ? result.matchedRecords
        : []) as MatchedRecord[];
      const rows = (Array.isArray(result.rowResults)
        ? result.rowResults
        : []) as UploadDisplayRow[];

      setMatchedRowsCount(Number(result.matchedRows ?? 0));
      setUnmatchedRowsCount(Number(result.unmatchedRows ?? 0));
      setUploadRows(rows);
      setMatchedRecords(records);
      setSelectedRowIndexes(
        new Set(rows.map((row) => row.rowIndex)),
      );

      toast.success(
        `Excel loaded: ${rows.length} row(s), ${Number(result.matchedRows ?? 0)} matched, ${Number(result.unmatchedRows ?? 0)} unmatched.`,
      );
    } catch (error: any) {
      toast.error(error?.message || "Failed to process file.");
      resetMatchedData();
    } finally {
      setIsMatching(false);
    }
  };

  const toggleSelectRow = (rowIndex: number) => {
    setSelectedRowIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(rowIndex)) next.delete(rowIndex);
      else next.add(rowIndex);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (allChecked) {
      setSelectedRowIndexes(new Set());
      return;
    }
    setSelectedRowIndexes(new Set(uploadRows.map((row) => row.rowIndex)));
  };

  const handleTransfer = async () => {
    if (selectedRows.length === 0) {
      toast.error("Walang selected rows.");
      return;
    }
    if (!tsaSelection && !tsmSelection && !managerSelection) {
      toast.error("Select at least one TSA, TSM, or Manager.");
      return;
    }

    const matchedSelectedRows = selectedRows.filter(
      (row) => row.matchedAccountIds.length > 0,
    );
    const unmatchedSelectedRows = selectedRows.filter(
      (row) => row.matchedAccountIds.length === 0,
    );

    const ids = Array.from(
      new Set(
        matchedSelectedRows.flatMap((row) => row.matchedAccountIds),
      ),
    );
    const idStrings = ids.map(String);
    const toastId = toast.loading("Transferring selected rows...");
    setIsTransferring(true);

    try {
      if (tsaSelection && idStrings.length > 0) {
        const res = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/BulkTransfer",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userIds: idStrings,
              type: "TSA",
              targetId: tsaSelection,
            }),
          },
        );
        const result = await res.json();
        if (!res.ok || !result?.success) {
          throw new Error(result?.error || "TSA transfer failed.");
        }
      }

      if (tsmSelection && idStrings.length > 0) {
        const res = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/BulkTransfer",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userIds: idStrings,
              type: "TSM",
              targetId: tsmSelection,
            }),
          },
        );
        const result = await res.json();
        if (!res.ok || !result?.success) {
          throw new Error(result?.error || "TSM transfer failed.");
        }
      }

      if (managerSelection && idStrings.length > 0) {
        const res = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/BulkTransfer",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userIds: idStrings,
              type: "Manager",
              targetId: managerSelection,
            }),
          },
        );
        const result = await res.json();
        if (!res.ok || !result?.success) {
          throw new Error(result?.error || "Manager transfer failed.");
        }
      }

      if (idStrings.length > 0) {
        const statusRes = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/BulkChange",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userIds: idStrings,
              status: "active",
            }),
          },
        );
        const statusResult = await statusRes.json();
        if (!statusRes.ok || !statusResult?.success) {
          throw new Error(statusResult?.error || "Failed to update status to active.");
        }
      }

      if (unmatchedSelectedRows.length > 0) {
        const importPayload = unmatchedSelectedRows.map((row) => ({
          referenceid: tsaSelection || "",
          manager: managerSelection || "",
          tsm: tsmSelection || "",
          company_name: row.source.company_name || "",
          contact_person: row.source.contact_person || "",
          contact_number: row.source.contact_number || "",
          email_address: row.source.email_address || "",
          type_client: row.source.type_client || "",
          address: row.source.address || "",
          delivery_address: row.source.delivery_address || "",
          region: "",
          status: "active",
          industry: "",
        }));

        const importRes = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/Import",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              data: importPayload,
            }),
          },
        );
        const importResult = await importRes.json();
        if (!importRes.ok) {
          throw new Error(importResult?.error || "Failed to create unmatched rows.");
        }
        if (Array.isArray(importResult?.failed) && importResult.failed.length > 0) {
          throw new Error(
            `May ${importResult.failed.length} unmatched row(s) na hindi na-create.`,
          );
        }
      }

      setMatchedRecords((prev) =>
        prev.map((record) =>
          selectedTransferIds.has(record.id)
            ? {
                ...record,
                ...(tsaSelection ? { referenceid: tsaSelection } : {}),
                ...(tsmSelection ? { tsm: tsmSelection } : {}),
                ...(managerSelection ? { manager: managerSelection } : {}),
                status: "active",
              }
            : record,
        ),
      );

      setAccountsAction?.((prev) =>
        prev.map((record) =>
          selectedTransferIds.has(Number(record.id))
            ? {
                ...record,
                ...(tsaSelection ? { referenceid: tsaSelection } : {}),
                ...(tsmSelection ? { tsm: tsmSelection } : {}),
                ...(managerSelection ? { manager: managerSelection } : {}),
                status: "active",
              }
            : record,
        ),
      );

      setSelectedRowIndexes(new Set());
      toast.success(
        `Done: ${matchedSelectedRows.length} matched row(s) + ${unmatchedSelectedRows.length} unmatched row(s) processed.`,
        { id: toastId },
      );
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error?.message || "Transfer failed.", { id: toastId });
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl bg-slate-900 border-slate-700 text-slate-100 rounded-none p-0 gap-0 max-h-[90vh] flex flex-col">

        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-slate-700/60 bg-slate-800/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-sm bg-cyan-500/10 border border-cyan-500/30">
              <Upload className="w-4 h-4 text-cyan-400" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold uppercase tracking-widest text-cyan-400">
                Upload & Transfer Matched Users
              </DialogTitle>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Match Excel rows against the database and transfer to TSA / TSM / Manager
              </p>
            </div>
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Assignment selects */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/70 mb-2 border-b border-slate-700/50 pb-1">
              Transfer Assignment
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { label: "Transfer to TSA", options: tsas, value: tsaSelection, onChange: setTsaSelection, placeholder: "Select TSA" },
                { label: "Transfer to TSM", options: tsms, value: tsmSelection, onChange: setTsmSelection, placeholder: "Select TSM" },
                { label: "Transfer to Manager", options: managers, value: managerSelection, onChange: setManagerSelection, placeholder: "Select Manager" },
              ].map(({ label, options, value, onChange, placeholder }) => (
                <div key={label} className="space-y-1">
                  <label className="text-[10px] font-semibold uppercase text-slate-500">{label}</label>
                  <Select value={value} onValueChange={onChange}>
                    <SelectTrigger className="h-8 text-xs bg-slate-800 border-slate-700 text-slate-200 rounded-none focus:border-cyan-500/50">
                      <SelectValue placeholder={placeholder} />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-slate-200">
                      {options.map((u) => (
                        <SelectItem key={u.value} value={u.value} className="text-xs focus:bg-cyan-500/10 focus:text-cyan-400">
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>

          {/* File upload */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-cyan-500/70 mb-2 border-b border-slate-700/50 pb-1">
              Excel File
            </p>
            <div className="flex flex-col sm:flex-row gap-2 items-start sm:items-center">
              <Input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFilePick(file);
                }}
                disabled={isMatching || isTransferring}
                className="max-w-sm h-8 text-xs bg-slate-800 border-slate-700 text-slate-300 rounded-none file:text-cyan-400 file:bg-transparent file:border-0 file:text-xs file:font-semibold"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={resetMatchedData}
                disabled={isMatching || isTransferring}
                className="h-8 text-xs rounded-none text-slate-400 hover:text-slate-200 hover:bg-slate-700"
              >
                Clear
              </Button>
              {(isMatching || isTransferring) && (
                <span className="text-xs text-slate-500 flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />
                  Processing…
                </span>
              )}
            </div>

            {fileName && (
              <p className="text-[11px] text-slate-500 mt-1.5">
                File: <span className="font-medium text-slate-300">{fileName}</span>
              </p>
            )}
          </div>

          {/* Stats row */}
          {(matchedRowsCount > 0 || unmatchedRowsCount > 0) && (
            <div className="flex flex-wrap gap-3">
              {[
                { label: "Total Rows", value: uploadRows.length },
                { label: "Matched", value: matchedRowsCount, color: "text-emerald-400" },
                { label: "Unmatched", value: unmatchedRowsCount, color: "text-amber-400" },
                { label: "DB Records", value: matchedRecords.length, color: "text-cyan-400" },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-none border border-slate-700 bg-slate-800/60 px-3 py-2 text-center min-w-[80px]">
                  <div className={`text-lg font-bold tabular-nums ${color ?? "text-slate-200"}`}>{value}</div>
                  <div className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</div>
                </div>
              ))}
            </div>
          )}

          {/* Table */}
          <div className="border border-slate-700/50 rounded-none overflow-auto max-h-[40vh] bg-slate-900/40">
            <Table className="whitespace-nowrap text-[12px] min-w-full">
              <TableHeader className="bg-slate-800/80 sticky top-0 z-10 border-b border-slate-700/50">
                <TableRow>
                  <TableHead className="w-10 text-center px-2 text-slate-400">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={handleSelectAll}
                      disabled={uploadRows.length === 0}
                    />
                  </TableHead>
                  <TableHead className="w-14 text-slate-400">Row</TableHead>
                  <TableHead className="min-w-[160px] text-slate-400">Company</TableHead>
                  <TableHead className="min-w-[130px] text-slate-400">Contact Person</TableHead>
                  <TableHead className="min-w-[120px] text-slate-400">Contact No.</TableHead>
                  <TableHead className="min-w-[160px] text-slate-400">Email</TableHead>
                  <TableHead className="min-w-[160px] text-slate-400">Address</TableHead>
                  <TableHead className="min-w-[160px] text-slate-400">Delivery Address</TableHead>
                  <TableHead className="min-w-[100px] text-slate-400">Type Client</TableHead>
                  <TableHead className="min-w-[80px] text-slate-400">Match</TableHead>
                  <TableHead className="min-w-[80px] text-slate-400">DB Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-[11px]">
                {uploadRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-slate-500 py-10">
                      No rows yet. Upload a file to display all Excel rows.
                    </TableCell>
                  </TableRow>
                ) : (
                  uploadRows.map((row) => {
                    const isMatched = row.matchedAccountIds.length > 0;
                    const firstMatched = isMatched
                      ? matchedRecordMap.get(row.matchedAccountIds[0])
                      : null;
                    const isSelected = selectedRowIndexes.has(row.rowIndex);
                    return (
                      <TableRow
                        key={row.rowIndex}
                        className={`border-b border-slate-800/60 hover:bg-slate-800/40 transition-colors text-slate-300 ${isSelected ? "bg-cyan-500/5" : ""}`}
                      >
                        <TableCell className="text-center px-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectRow(row.rowIndex)}
                          />
                        </TableCell>
                        <TableCell className="text-slate-500">{row.rowIndex}</TableCell>
                        <TableCell className="font-medium text-slate-200 uppercase">{row.source.company_name}</TableCell>
                        <TableCell className="capitalize">{row.source.contact_person}</TableCell>
                        <TableCell>{row.source.contact_number}</TableCell>
                        <TableCell className="text-slate-400">{row.source.email_address}</TableCell>
                        <TableCell className="text-slate-400">{row.source.address}</TableCell>
                        <TableCell className="text-slate-400">{row.source.delivery_address}</TableCell>
                        <TableCell>{row.source.type_client}</TableCell>
                        <TableCell>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${row.matched ? "bg-emerald-900/60 text-emerald-300" : "bg-amber-900/60 text-amber-300"}`}>
                            {row.matched ? "Matched" : "Unmatched"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className={toKey(firstMatched?.status) === "active" ? "text-emerald-400" : "text-slate-500"}>
                            {firstMatched?.status || "—"}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-3 border-t border-slate-700/60 bg-slate-800/60 shrink-0 flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isMatching || isTransferring}
            className="h-8 text-xs rounded-none text-slate-400 hover:text-slate-200 hover:bg-slate-700"
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={isMatching || isTransferring || selectedRows.length === 0}
            className="h-8 text-xs rounded-none bg-cyan-600 hover:bg-cyan-500 text-white border-0 px-5 gap-2"
          >
            {isTransferring ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Transferring…
              </>
            ) : (
              <>
                <Upload className="h-3.5 w-3.5" />
                Transfer Selected ({selectedRows.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
