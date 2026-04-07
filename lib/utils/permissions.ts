/**
 * Permission utilities for checking user access to specific modules and submodules
 */

export interface UserPermissions {
  modules: string[];
  submodules: string[];
}

// Permission mapping for sidebar items
export const PERMISSION_MAP: Record<string, string> = {
  // Main modules
  'audit-logs': 'acculog',
  'admin/audit-settings': 'acculog',
  'application/modules': 'applications',
  'taskflow/customer-database': 'taskflow:Customer Database',
  'taskflow/removal-accounts': 'taskflow:Removal Accounts',
  'taskflow/customer-audits': 'taskflow:Customer Audits',
  'taskflow/customer-approval': 'taskflow:Approval of Accounts',
  'taskflow/activity-logs': 'taskflow:Activity Logs',
  'taskflow/progress-logs': 'taskflow:Progress Logs',
  'taskflow/csr-inquiries': 'taskflow:Endorsed Tickets',
  'stash/inventory': 'stash:Inventory',
  'stash/assigned-assets': 'stash:Assigned Assets',
  'stash/license': 'stash:License',
  'ticketing': 'help-desk',
  'ticketing/service-catalogue': 'help-desk:Service Catalogue',
  'cloudflare/dns': 'cloudflare:DNS',
  'cloudflare/analytics': 'cloudflare:Analytics',
  'cloudflare/firewall': 'cloudflare:FirewallRules',
  'admin/roles': 'user-accounts:Roles',
  'admin/users': 'user-accounts:Resigned and Terminated',
  'admin/sessions': 'user-accounts:Sessions',
  'admin/it-permissions': 'user-accounts:IT Permissions',
  'settings/general': 'settings:General',
  'admin/backup-database': 'settings:Database Backup',
  'dashboard': 'dashboard-access', // Dashboard is always visible
  'profile': 'profile-access', // Profile is always visible
  'acculog/activity-logs': 'acculog:Activity Logs',
};

/**
 * Check if user has permission for a specific route or permission key
 */
export function hasPermission(userPermissions: UserPermissions, route: string): boolean {
  // Super Admin with wildcard can access everything
  if (userPermissions.submodules.includes("*")) {
    return true;
  }
  
  // Check if the route itself is a permission key (format: "module:item")
  if (route.includes(':')) {
    // Direct permission key check - MUST have explicit submodule permission
    if (userPermissions.submodules.includes(route)) {
      return true;
    }
    // User must have explicit submodule permission
    return false;
  }
  
  const permission = PERMISSION_MAP[route];
  
  // Dashboard and profile are always accessible
  if (permission === 'dashboard-access' || permission === 'profile-access') {
    return true;
  }
  
  // If no permission mapping found, deny access
  if (!permission) {
    return false;
  }
  
  // Check module access
  if (userPermissions.modules.includes(permission)) {
    return true;
  }
  
  // Check submodule access
  if (userPermissions.submodules.includes(permission)) {
    return true;
  }
  
  return false;
}

/**
 * Check if user has any of the specified permissions
 */
export function hasAnyPermission(userPermissions: UserPermissions, permissions: string[]): boolean {
  return permissions.some(permission => 
    userPermissions.modules.includes(permission) || 
    userPermissions.submodules.includes(permission)
  );
}

/**
 * Get user permissions from API
 */
export async function getUserPermissions(email: string): Promise<UserPermissions> {
  try {
    const response = await fetch('/api/ITPermissions/GetUserPermissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    
    if (!response.ok) {
      return { modules: [], submodules: [] };
    }
    
    const data = await response.json();
    return data.success ? data.permissions : { modules: [], submodules: [] };
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    return { modules: [], submodules: [] };
  }
}
