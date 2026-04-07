import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/MongoDB";

// Complete ERP sidebar modules configuration
const DEFAULT_SIDEBAR_MODULES = [
  // 1. DASHBOARD
  {
    key: "dashboard",
    title: "Dashboard",
    icon: "LayoutDashboard",
    description: "Main overview and KPIs",
    items: [
      { title: "Overview", url: "/dashboard" },
      { title: "My Tasks", url: "/dashboard/tasks" },
      { title: "Notifications", url: "/dashboard/notifications" },
    ],
  },
  // 2. OPERATIONS
  {
    key: "taskflow",
    title: "Taskflow",
    icon: "Activity",
    description: "Sales tracking and customer management",
    items: [
      { title: "Customer Database", url: "/taskflow/customer-database" },
      { title: "Customer Audits", url: "/taskflow/customer-audits" },
      { title: "Approval of Accounts", url: "/taskflow/customer-approval" },
      { title: "Activity Logs", url: "/taskflow/activity-logs" },
      { title: "Progress Logs", url: "/taskflow/progress-logs" },
      { title: "Endorsed Tickets", url: "/taskflow/csr-inquiries" },
    ],
  },
  {
    key: "help-desk",
    title: "Help Desk",
    icon: "TicketCheck",
    description: "IT ticketing system",
    items: [
      { title: "Tickets", url: "/ticketing/tickets" },
      { title: "Service Catalogue", url: "/ticketing/service-catalogue" },
    ],
  },
  {
    key: "projects",
    title: "Projects",
    icon: "FolderKanban",
    description: "Project management",
    items: [
      { title: "Project List", url: "/projects" },
      { title: "Timesheets", url: "/projects/timesheets" },
      { title: "Resource Planning", url: "/projects/resources" },
    ],
  },
  // 3. CRM
  {
    key: "crm",
    title: "CRM",
    icon: "Users",
    description: "Customer relationship management",
    items: [
      { title: "Customer List", url: "/crm/customers" },
      { title: "Leads & Opportunities", url: "/crm/leads" },
      { title: "Communications", url: "/crm/communications" },
      { title: "Contracts", url: "/crm/contracts" },
    ],
  },
  // 4. ASSETS & INVENTORY
  {
    key: "stash",
    title: "Stash",
    icon: "Boxes",
    description: "IT inventory management",
    items: [
      { title: "Inventory", url: "/stash/inventory" },
      { title: "Assigned Assets", url: "/stash/assigned-assets" },
      { title: "License Management", url: "/stash/license" },
    ],
  },
  {
    key: "stock",
    title: "Stock Management",
    icon: "Package",
    description: "Stock and warehouse management",
    items: [
      { title: "Stock Levels", url: "/stock/levels" },
      { title: "Purchase Orders", url: "/stock/purchase-orders" },
      { title: "Suppliers", url: "/stock/suppliers" },
    ],
  },
  // 5. FINANCE
  {
    key: "finance",
    title: "Finance",
    icon: "DollarSign",
    description: "Financial management",
    items: [
      { title: "Invoices", url: "/finance/invoices" },
      { title: "Payments", url: "/finance/payments" },
      { title: "Expenses", url: "/finance/expenses" },
    ],
  },
  {
    key: "payroll",
    title: "Payroll",
    icon: "Wallet",
    description: "Employee payroll management",
    items: [
      { title: "Employee Payroll", url: "/payroll/employees" },
      { title: "Salary Structure", url: "/payroll/salary-structure" },
      { title: "Payslips", url: "/payroll/payslips" },
    ],
  },
  // 6. HUMAN RESOURCES
  {
    key: "hr",
    title: "Human Resources",
    icon: "UserCircle",
    description: "HR management",
    items: [
      { title: "Employee Directory", url: "/hr/employees" },
      { title: "Leave Management", url: "/hr/leave" },
      { title: "Attendance", url: "/hr/attendance" },
    ],
  },
  {
    key: "recruitment",
    title: "Recruitment",
    icon: "UserPlus",
    description: "Hiring and recruitment",
    items: [
      { title: "Job Postings", url: "/recruitment/jobs" },
      { title: "Applicants", url: "/recruitment/applicants" },
      { title: "Interviews", url: "/recruitment/interviews" },
    ],
  },
  // 7. ADMINISTRATION
  {
    key: "audit-logs",
    title: "Audit Logs",
    icon: "FileText",
    description: "System audit and activity logs",
    items: [
      { title: "View Logs", url: "/audit-logs" },
      { title: "Settings", url: "/admin/audit-settings" },
    ],
  },
  {
    key: "user-accounts",
    title: "User Accounts",
    icon: "BookOpen",
    description: "Role and permission management",
    items: [
      { title: "Roles & Permissions", url: "/admin/roles" },
      { title: "Sessions", url: "/admin/sessions" },
      { title: "IT Permissions", url: "/admin/it-permissions" },
    ],
  },
  {
    key: "settings",
    title: "Settings",
    icon: "Settings2",
    description: "System settings",
    items: [
      { title: "General", url: "/settings/general" },
      { title: "Database Backup", url: "/admin/backup-database" },
    ],
  },
  // 8. REPORTS & ANALYTICS
  {
    key: "reports",
    title: "Reports",
    icon: "BarChart3",
    description: "Business reports and analytics",
    items: [
      { title: "Sales Reports", url: "/reports/sales" },
      { title: "Financial Reports", url: "/reports/finance" },
      { title: "HR Reports", url: "/reports/hr" },
    ],
  },
  {
    key: "analytics",
    title: "Analytics",
    icon: "PieChart",
    description: "Business intelligence",
    items: [
      { title: "Business Intelligence", url: "/analytics/bi" },
      { title: "KPI Dashboards", url: "/analytics/kpi" },
    ],
  },
  // 9. DOCUMENTS
  {
    key: "documents",
    title: "Documents",
    icon: "FileStack",
    description: "File and document management",
    items: [
      { title: "File Manager", url: "/documents/files" },
      { title: "Templates", url: "/documents/templates" },
      { title: "Approvals", url: "/documents/approvals" },
    ],
  },
  // 10. TOOLS
  {
    key: "applications",
    title: "Applications",
    icon: "SquareTerminal",
    description: "Module access and applications",
    items: [{ title: "Modules", url: "/application/modules" }],
  },
  {
    key: "cloudflare",
    title: "CloudFlare",
    icon: "Bot",
    description: "DNS management",
    items: [{ title: "DNS", url: "/cloudflare/dns" }],
  },
  // 11. ACCULOG (HRIS)
  {
    key: "acculog",
    title: "Acculog",
    icon: "CalendarCheck",
    description: "HRIS module for attendance and logs",
    items: [
      { title: "Activity Logs", url: "/acculog/activity-logs" },
      { title: "Attendance", url: "/acculog/attendance" },
    ],
  },
];

export async function GET(req: NextRequest) {
  try {
    const db = await connectToDatabase();
    
    // Fetch existing modules
    let modules = await db
      .collection("sidebar_modules")
      .find({})
      .sort({ order: 1 })
      .toArray();

    // Check if we need to update (missing new ERP modules)
    const requiredKeys = DEFAULT_SIDEBAR_MODULES.map(m => m.key);
    const existingKeys = modules.map((m: any) => m.key);
    const hasAllModules = requiredKeys.every(key => existingKeys.includes(key));
    
    if (!hasAllModules || modules.length === 0) {
      // Clear existing and insert fresh with all ERP modules
      await db.collection("sidebar_modules").deleteMany({});
      
      const modulesToInsert = DEFAULT_SIDEBAR_MODULES.map((m, index) => ({
        ...m,
        order: index,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));
      
      await db.collection("sidebar_modules").insertMany(modulesToInsert);
      
      // Fetch fresh data
      modules = await db
        .collection("sidebar_modules")
        .find({})
        .sort({ order: 1 })
        .toArray();
    }

    // Format modules for response
    const formattedModules = modules.map((m: any) => ({
      key: m.key,
      title: m.title,
      icon: m.icon,
      description: m.description,
      items: m.items,
      order: m.order,
    }));

    return NextResponse.json({
      success: true,
      modules: formattedModules,
    });
  } catch (error: any) {
    console.error("Error fetching sidebar modules:", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch sidebar modules" },
      { status: 500 }
    );
  }
}
