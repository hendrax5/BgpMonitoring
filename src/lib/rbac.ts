/**
 * RBAC helper — check if a role can perform an action
 *
 * Role hierarchy: superadmin > orgadmin > viewer
 */

type Role = 'superadmin' | 'orgadmin' | 'viewer';

type Action =
    | 'manage:tenants'      // superadmin only
    | 'manage:users'        // superadmin + orgadmin
    | 'manage:devices'      // superadmin + orgadmin
    | 'manage:settings'     // superadmin + orgadmin
    | 'view:dashboard'      // all roles
    | 'view:reports'        // all roles
    | 'view:peers';         // all roles

const permissions: Record<Action, Role[]> = {
    'manage:tenants':  ['superadmin'],
    'manage:users':    ['superadmin', 'orgadmin'],
    'manage:devices':  ['superadmin', 'orgadmin'],
    'manage:settings': ['superadmin', 'orgadmin'],
    'view:dashboard':  ['superadmin', 'orgadmin', 'viewer'],
    'view:reports':    ['superadmin', 'orgadmin', 'viewer'],
    'view:peers':      ['superadmin', 'orgadmin', 'viewer'],
};

export function can(role: Role, action: Action): boolean {
    return permissions[action]?.includes(role) ?? false;
}

export function isSuperAdmin(role: Role): boolean {
    return role === 'superadmin';
}

export function isOrgAdmin(role: Role): boolean {
    return role === 'superadmin' || role === 'orgadmin';
}
