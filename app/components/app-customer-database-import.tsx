"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import * as ExcelJS from "exceljs";
import { toast } from "sonner";
import { Upload as UploadIcon } from "lucide-react";
import { Download as DownloadIcon } from "lucide-react";

interface Option {
  value: string;
  label: string;
}

export function ImportDialog() {
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [failedRows, setFailedRows] = useState<any[]>([]); // State to store failed rows
  const [originalFileName, setOriginalFileName] = useState<string | null>(null);

  const [managerOptions, setManagerOptions] = useState<Option[]>([]);
  const [tsmOptions, setTsmOptions] = useState<Option[]>([]);
  const [tsaOptions, setTsaOptions] = useState<Option[]>([]);

  const [selectedManager, setSelectedManager] = useState<Option | null>(null);
  const [selectedTSM, setSelectedTSM] = useState<Option | null>(null);
  const [selectedTSA, setSelectedTSA] = useState<Option | null>(null);

  useEffect(() => {
    fetch("/api/UserManagement/FetchManager?Role=Manager")
      .then((res) => res.json())
      .then((data) =>
        setManagerOptions(
          data.map((u: any) => ({
            value: u.ReferenceID,
            label: `${u.Firstname} ${u.Lastname}`,
          }))
        )
      )
      .catch((err) => console.error("Error fetching managers:", err));
  }, []);

  useEffect(() => {
    // Fetch TSMs based on the selected Manager
    if (selectedManager) {
      fetch(
        `/api/UserManagement/FetchTSM?Role=Territory Sales Manager&managerReferenceID=${selectedManager.value}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTsmOptions(
              data.map((u: any) => ({
                value: u.ReferenceID,
                label: `${u.Firstname} ${u.Lastname}`,
              }))
            );
          } else {
            console.warn("Data is not an array:", data);
            setTsmOptions([]); // Set to empty array to avoid errors
          }
        })
        .catch((err) => console.error("Error fetching TSM:", err));
    } else {
      // If no manager is selected, clear the TSM options
      setTsmOptions([]);
    }
    // Reset selected TSM when manager changes
    setSelectedTSM(null);
  }, [selectedManager]);

  useEffect(() => {
    // Fetch TSAs based on the selected Manager
    if (selectedTSM) {
      fetch(
        `/api/UserManagement/FetchTSA?Role=Territory Sales Associate&managerReferenceID=${selectedTSM.value}`
      )
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setTsaOptions(
              data.map((u: any) => ({
                value: u.ReferenceID,
                label: `${u.Firstname} ${u.Lastname}`,
              }))
            );
          } else {
            console.warn("Data is not an array:", data);
            setTsaOptions([]); // Set to empty array to avoid errors
          }
        })
        .catch((err) => console.error("Error fetching TSA:", err));
    } else {
      // If no manager is selected, clear the TSA options
      setTsaOptions([]);
    }
    // Reset selected TSA when manager changes
    setSelectedTSA(null);
  }, [selectedTSM]);

  const parseExcel = async (file: File) => {
    const reader = new FileReader();
    return new Promise<any[]>((resolve, reject) => {
      reader.onload = async (event) => {
        try {
          const data = event.target?.result as ArrayBuffer;
          const workbook = new ExcelJS.Workbook();
          await workbook.xlsx.load(data);
          const worksheet = workbook.worksheets[0];
          const parsed: any[] = [];

          worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header
            parsed.push({
              referenceid: selectedTSA?.value || "",
              manager: selectedManager?.value || "",
              tsm: selectedTSM?.value || "",
              tsa: selectedTSA?.value || "",
              company_name: row.getCell(1).value || "",
              contact_person: row.getCell(2).value || "",
              contact_number: row.getCell(3).value || "",
              email_address: row.getCell(4).value || "",
              type_client: row.getCell(5).value || "",
              address: row.getCell(6).value || "",
              region: row.getCell(7).value || "",
              status: row.getCell(8).value || "",
              company_group: row.getCell(9).value || "",
              delivery_address: row.getCell(10).value || "",
              industry: row.getCell(11).value || "",
            });
          });

          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);
    setOriginalFileName(selectedFile.name.replace(/\.[^/.]+$/, "")); // Store filename without extension
    parseExcel(selectedFile)
      .then(setPreviewData)
      .catch(() => toast.error("Failed to parse Excel file."));
  };

  const handleUpload = async () => {
    if (!file) return toast.error("Please select a file.");
    if (!selectedTSA) return toast.error("Please select a TSA.");

    setIsLoading(true);
    setFailedRows([]); // Clear previous failed rows

    try {
      const parsed = await parseExcel(file);
      const total = parsed.length;
      const batchSize = 10; // adjust batch size as needed
      const failed: any[] = []; // Accumulate failed rows

      for (let i = 0; i < total; i += batchSize) {
        const batch = parsed.slice(i, i + batchSize);

        // Show toast with count and first company in the batch
        toast(
          `Uploading ${i + 1}-${Math.min(i + batchSize, total)}/${total}: ${
            batch[0].company_name
          }`,
          { duration: 1000 }
        );

        const response = await fetch(
          "/api/Data/Applications/Taskflow/CustomerDatabase/Import",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              referenceid: selectedTSA.value,
              tsm: selectedTSM?.value || "",
              data: batch,
            }),
          }
        );

        const result = await response.json();

        if (!result.success && result.failed) {
          // Collect failed rows
          failed.push(...result.failed);
        }
      }

      if (failed.length > 0) {
        setFailedRows(failed);
        toast.error(
          `Failed to import ${failed.length} records. Download the failed rows for review.`
        );
      } else {
        toast.success(`Successfully imported ${total} records.`);
      }

      setFile(null);
      setPreviewData([]);
    } catch (err) {
      console.error(err);
      toast.error("Failed to import file.");
    } finally {
      setIsLoading(false);
    }
  };
  const handleDownloadFailed = () => {
    if (failedRows.length === 0) {
      toast.info("No failed rows to download.");
      return;
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Failed Rows");

    // Add headers
    worksheet.addRow([
      "company_name",
      "contact_person",
      "contact_number",
      "email_address",
      "type_client",
      "address",
      "region",
      "status",
      "company_group",
      "delivery_address",
      "industry",
    ]);

    // Add data rows
    failedRows.forEach((row) => {
      worksheet.addRow([
        row.company_name,
        row.contact_person,
        row.contact_number,
        row.email_address,
        row.type_client,
        row.address,
        row.region,
        row.status,
        row.company_group,
        row.delivery_address,
        row.industry,
      ]);
    });

    // Generate and trigger download
    workbook.xlsx.writeBuffer().then((buffer) => {
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${originalFileName || "failed_rows"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-1">
          <UploadIcon className="w-4 h-4" /> Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Import Customers</DialogTitle>
          <DialogDescription>
            Upload an Excel file to import customer data.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          {/* Manager / TSM / TSA selects */}
          <div className="flex gap-2">
            <Select
              value={selectedManager?.value || ""}
              onValueChange={(v) => {
                const manager = managerOptions.find((m) => m.value === v) || null;
                setSelectedManager(manager);
                setSelectedTSM(null);
                setSelectedTSA(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Manager" />
              </SelectTrigger>
              <SelectContent>
                {managerOptions.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedTSM?.value || ""}
              // onValueChange={(v) => setSelectedTSM(tsmOptions.find((t) => t.value === v) || null)}
              disabled={!selectedManager}
              onValueChange={(v) => {
                const tsm = tsmOptions.find((t) => t.value === v) || null;
                setSelectedTSM(tsm);
                setSelectedTSA(null);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select TSM" />
              </SelectTrigger>
              <SelectContent>
                {tsmOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={selectedTSA?.value || ""}
              // onValueChange={(v) => setSelectedTSA(tsaOptions.find((t) => t.value === v) || null)}
              disabled={!selectedManager}
              onValueChange={(v) => {
                const tsa = tsaOptions.find((t) => t.value === v) || null;
                setSelectedTSA(tsa);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select TSA" />
              </SelectTrigger>
              <SelectContent>
                {tsaOptions.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File input */}
          <div className="grid gap-2">
            <Label>Excel File</Label>
            <Input type="file" onChange={handleFileChange} />
          </div>

          {/* Preview Table */}
          {previewData.length > 0 && (
            <div className="overflow-auto max-h-64 border rounded-md p-2 text-xs">
              <Table className="whitespace-nowrap">
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Type of Client</TableHead>
                    <TableHead>Address</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Company Group</TableHead>
                    <TableHead>Delivery Address</TableHead>
                    <TableHead>Industry</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="whitespace-normal break-words max-w-[250px]">
                        {row.company_name}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[250px]">
                        {row.contact_person}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[250px]">
                        {row.email_address}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.type_client}
                      </TableCell>
                      <TableCell className="whitespace-normal break-words max-w-[250px]">
                        {row.address}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.region}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.status}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.company_group}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.delivery_address}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {row.industry}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4 flex justify-between items-center">
          {failedRows.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleDownloadFailed}
              className="flex items-center gap-1"
            >
              <DownloadIcon className="w-4 h-4" />
              Download Failed ({failedRows.length})
            </Button>
          )}
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button
              onClick={handleUpload}
              disabled={isLoading}
              className="flex items-center gap-1"
            >
              {isLoading ? (
                "Uploading..."
              ) : (
                <>
                  <UploadIcon className="w-4 h-4" /> Upload
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}