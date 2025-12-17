"use client";

import React, { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

interface Company {
  account_reference_number: string;
  company_name: string;
  contact_number: string;
  type_client: string;
  contact_person: string;
  email_address: string;
  address: string;
}

interface Activity {
  id: string;
  account_reference_number: string;
  status: string;
  date_created: string;
  date_updated: string;
  ticket_reference_number: string;
}

export default function EcodeskActivityTable() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isFetchingActivities, setIsFetchingActivities] = useState(false);
  const [isFetchingCompanies, setIsFetchingCompanies] = useState(false);

  // Example filters:
  const allowedStatuses = ["Open", "In Progress", "Closed"]; // customize this as needed
  const dateCreatedFilterRange = { from: undefined as Date | undefined, to: undefined as Date | undefined }; // fill as needed or make state

  // Helper to check if date is within range
  const isDateInRange = (dateStr: string, range: { from?: Date; to?: Date }) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    if (range.from && date < range.from) return false;
    if (range.to && date > range.to) return false;
    return true;
  };

  // Fetch activities
  const fetchActivities = async () => {
    setIsFetchingActivities(true);
    try {
      const res = await fetch("/api/Data/Applications/Ecodesk/Tickets/FetchActivity");
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error || "Failed to fetch activity");
      }
      setActivities(json.data || []);
    } catch (err) {
      toast.error("Error fetching Ecodesk Activity.");
      console.error(err);
    } finally {
      setIsFetchingActivities(false);
    }
  };

  // Fetch companies
  const fetchCompanies = async () => {
    setIsFetchingCompanies(true);
    try {
      const res = await fetch("/api/Data/Applications/Taskflow/CustomerDatabase/Fetch", {
        cache: "no-store",
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch company data");
      const data = await res.json();
      setCompanies(data.data || []);
    } catch (err) {
      toast.error("Error fetching companies.");
      console.error(err);
    } finally {
      setIsFetchingCompanies(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    fetchCompanies();
  }, []);

  // Merge activities + companies and filter
  const mergedData = useMemo(() => {
  if (companies.length === 0 || activities.length === 0) return [];

  return activities
    .filter((a) => allowedStatuses.includes(a.status))
    .filter((a) => isDateInRange(a.date_created, dateCreatedFilterRange))
    .map((activity) => {
      const company = companies.find(
        (c) =>
          c.account_reference_number &&
          activity.account_reference_number &&
          c.account_reference_number.toLowerCase() === activity.account_reference_number.toLowerCase()
      );

      return {
        ...activity,
        company_name: company?.company_name ?? "Unknown Company",
        contact_number: company?.contact_number ?? "-",
        type_client: company?.type_client ?? "",
        contact_person: company?.contact_person ?? "",
        email_address: company?.email_address ?? "",
        address: company?.address ?? "",
      };
    })
    .sort((a, b) => new Date(b.date_updated).getTime() - new Date(a.date_updated).getTime());
}, [activities, companies, dateCreatedFilterRange]);


  return (
    <div className="border border-border shadow-sm rounded-lg overflow-hidden max-w-4xl mx-auto mt-8">
      <div className="bg-muted px-3 py-2 text-xs font-semibold">Ecodesk Ticket Activity</div>

      {(isFetchingActivities || isFetchingCompanies) ? (
        <div className="p-4 text-center text-sm text-muted-foreground">Loading...</div>
      ) : mergedData.length === 0 ? (
        <div className="p-4 text-center text-sm text-muted-foreground">No Ecodesk activity data found.</div>
      ) : (
        <Table className="w-full text-xs">
          <TableHeader>
            <TableRow>
              <TableHead>Ticket Reference #</TableHead>
              <TableHead>Company Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Contact Number</TableHead>
              <TableHead>Email Address</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mergedData.map((item, idx) => (
              <TableRow key={`${item.id}-${idx}`}>
                <TableCell>{item.ticket_reference_number}</TableCell>
                <TableCell>{item.company_name}</TableCell>
                <TableCell>{item.contact_person}</TableCell>
                <TableCell>{item.contact_number}</TableCell>
                <TableCell>{item.email_address}</TableCell>
                <TableCell>{item.status}</TableCell>
                <TableCell>{new Date(item.date_updated).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
