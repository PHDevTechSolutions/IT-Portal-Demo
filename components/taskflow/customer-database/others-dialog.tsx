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
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload and Transfer Matched Users</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium">Transfer to TSA</label>
              <Select value={tsaSelection} onValueChange={setTsaSelection}>
                <SelectTrigger>
                  <SelectValue placeholder="Select TSA" />
                </SelectTrigger>
                <SelectContent>
                  {tsas.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Transfer to TSM</label>
              <Select value={tsmSelection} onValueChange={setTsmSelection}>
                <SelectTrigger>
                  <SelectValue placeholder="Select TSM" />
                </SelectTrigger>
                <SelectContent>
                  {tsms.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Transfer to Manager</label>
              <Select value={managerSelection} onValueChange={setManagerSelection}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Manager" />
                </SelectTrigger>
                <SelectContent>
                  {managers.map((u) => (
                    <SelectItem key={u.value} value={u.value}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

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
              className="max-w-md"
            />
            <Button
              type="button"
              variant="outline"
              onClick={resetMatchedData}
              disabled={isMatching || isTransferring}
            >
              Clear File
            </Button>
            {(isMatching || isTransferring) && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Processing...
              </span>
            )}
          </div>

          {fileName && (
            <div className="text-xs text-muted-foreground">
              File: <span className="font-medium text-foreground">{fileName}</span>
            </div>
          )}

          {(matchedRowsCount > 0 || unmatchedRowsCount > 0) && (
            <div className="text-xs">
              Excel rows: <span className="font-semibold">{uploadRows.length}</span> | Matched rows:{" "}
              <span className="font-semibold">{matchedRowsCount}</span> | Unmatched rows:{" "}
              <span className="font-semibold">{unmatchedRowsCount}</span> | Unique matched records:{" "}
              <span className="font-semibold">{matchedRecords.length}</span>
            </div>
          )}

          <div className="border rounded-sm overflow-auto max-h-[45vh]">
            <Table>
              <TableHeader className="sticky top-0 bg-muted z-10">
                <TableRow>
                  <TableHead className="w-10 text-center">
                    <input
                      type="checkbox"
                      checked={allChecked}
                      onChange={handleSelectAll}
                      disabled={uploadRows.length === 0}
                    />
                  </TableHead>
                  <TableHead className="w-16">Row</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Contact Person</TableHead>
                  <TableHead>Contact Number</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Delivery Address</TableHead>
                  <TableHead>Type Client</TableHead>
                  <TableHead>Match</TableHead>
                  <TableHead>DB Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {uploadRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                      No rows yet. Upload a file to display all Excel rows.
                    </TableCell>
                  </TableRow>
                ) : (
                  uploadRows.map((row) => {
                    const isMatched = row.matchedAccountIds.length > 0;
                    const firstMatched = isMatched
                      ? matchedRecordMap.get(row.matchedAccountIds[0])
                      : null;
                    return (
                    <TableRow key={row.rowIndex}>
                      <TableCell className="text-center">
                        <input
                          type="checkbox"
                          checked={selectedRowIndexes.has(row.rowIndex)}
                          onChange={() => toggleSelectRow(row.rowIndex)}
                        />
                      </TableCell>
                      <TableCell>{row.rowIndex}</TableCell>
                      <TableCell>{row.source.company_name}</TableCell>
                      <TableCell>{row.source.contact_person}</TableCell>
                      <TableCell>{row.source.contact_number}</TableCell>
                      <TableCell>{row.source.email_address}</TableCell>
                      <TableCell>{row.source.address}</TableCell>
                      <TableCell>{row.source.delivery_address}</TableCell>
                      <TableCell>{row.source.type_client}</TableCell>
                      <TableCell className={row.matched ? "text-emerald-600" : "text-amber-600"}>
                        {row.matched ? "Matched" : "Unmatched"}
                      </TableCell>
                      <TableCell
                        className={
                          toKey(firstMatched?.status) === "active"
                            ? "text-emerald-600"
                            : ""
                        }
                      >
                        {firstMatched?.status || "-"}
                      </TableCell>
                    </TableRow>
                  )})
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter className="mt-4 flex justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMatching || isTransferring}
          >
            Cancel
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={isMatching || isTransferring || selectedRows.length === 0}
            className="gap-2"
          >
            {isTransferring ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Transfer Selected ({selectedRows.length})
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
