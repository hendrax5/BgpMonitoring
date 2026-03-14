/**
 * RBAC — permission matrix sesuai tabel
 *
 * Roles: superadmin > orgadmin > networkengineer > viewer
 */

export type Role = 'superadmin' | 'orgadmin' | 'networkengineer' | 'viewer';

export type Action =
    // Tenant
    | 'tenant.create'           // create/delete tenant
    | 'tenant.editSubscription' // edit plan/limit
    // User
    | 'user.manageGlobal'       // manage users across all tenants
    | 'user.manageTenant'       // manage users in same tenant
    // Device
    | 'device.manage'           // add/edit/delete device
    | 'device.view'             // view device list & status
    // Monitoring
    | 'monitoring.view'         // view dashboard & metrics
    | 'monitoring.configAlerts' // configure alert thresholds
    // Config
    | 'config.pull'             // pull config (manual backup)
    | 'config.viewHistory'      // view config history/diff
    | 'config.rollback'         // rollback configuration
    // System
    | 'system.viewGlobalAudit'  // view global audit logs
    | 'system.viewTenantAudit'; // view tenant audit logs

const permissions: Record<Action, Role[]> = {
    // Tenant
    'tenant.create':           ['superadmin'],
    'tenant.editSubscription': ['superadmin'],
    // User
    'user.manageGlobal':       ['superadmin'],
    'user.manageTenant':       ['superadmin', 'orgadmin'],
    // Device
    'device.manage':           ['superadmin', 'orgadmin'],
    'device.view':             ['superadmin', 'orgadmin', 'networkengineer', 'viewer'],
    // Monitoring
    'monitoring.view':         ['superadmin', 'orgadmin', 'networkengineer', 'viewer'],
    'monitoring.configAlerts': ['superadmin', 'orgadmin', 'networkengineer'],
    // Config
    'config.pull':             ['superadmin', 'orgadmin', 'networkengineer'],
    'config.viewHistory':      ['superadmin', 'orgadmin', 'networkengineer'],
    'config.rollback':         ['superadmin', 'orgadmin'],
    // System
    'system.viewGlobalAudit':  ['superadmin'],
    'system.viewTenantAudit':  ['superadmin', 'orgadmin'],
};

export function can(role: Role | string, action: Action): boolean {
    return (permissions[action] as string[])?.includes(role) ?? false;
}

export function isSuperAdmin(role: Role | string): boolean {
    return role === 'superadmin';
}

export function isOrgAdmin(role: Role | string): boolean {
    return role === 'superadmin' || role === 'orgadmin';
}

export function canManageDevices(role: Role | string): boolean {
    return can(role as Role, 'device.manage');
}

export function canManageUsers(role: Role | string): boolean {
    return can(role as Role, 'user.manageTenant');
}

export function canConfigAlerts(role: Role | string): boolean {
    return can(role as Role, 'monitoring.configAlerts');
}
