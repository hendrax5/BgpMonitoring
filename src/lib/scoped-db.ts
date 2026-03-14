/**
 * Scoped Prisma helper — semua query otomatis terfilter by tenantId
 * 
 * Usage:
 *   const db = scopedDb(session.tenantId);
 *   const devices = await db.routerDevice.findMany();  // auto WHERE tenant_id = ?
 */

import { prisma } from './prisma';

// Helper to merge where clause with tenantId
function withTenant(tenantId: string, args?: any) {
    return {
        ...args,
        where: { ...args?.where, tenantId },
    };
}

export function scopedDb(tenantId: string) {
    return {
        routerDevice: {
            findMany: (args?: any) => (prisma as any).routerDevice.findMany(withTenant(tenantId, args)),
            findFirst: (args?: any) => (prisma as any).routerDevice.findFirst(withTenant(tenantId, args)),
            findUnique: (args?: any) => (prisma as any).routerDevice.findFirst(withTenant(tenantId, args)),
            create: (args: any) => (prisma as any).routerDevice.create({ ...args, data: { ...args.data, tenantId } }),
            update: (args: any) => (prisma as any).routerDevice.updateMany(withTenant(tenantId, args)),
            delete: (args: any) => (prisma as any).routerDevice.deleteMany(withTenant(tenantId, args)),
            count: (args?: any) => (prisma as any).routerDevice.count(withTenant(tenantId, args)),
        },
        deviceCredential: {
            findMany: (args?: any) => (prisma as any).deviceCredential.findMany(withTenant(tenantId, args)),
            findFirst: (args?: any) => (prisma as any).deviceCredential.findFirst(withTenant(tenantId, args)),
            create: (args: any) => (prisma as any).deviceCredential.create({ ...args, data: { ...args.data, tenantId } }),
            update: (args: any) => (prisma as any).deviceCredential.updateMany(withTenant(tenantId, args)),
            delete: (args: any) => (prisma as any).deviceCredential.deleteMany(withTenant(tenantId, args)),
        },
        historicalEvent: {
            findMany: (args?: any) => (prisma as any).historicalEvent.findMany(withTenant(tenantId, args)),
            findFirst: (args?: any) => (prisma as any).historicalEvent.findFirst(withTenant(tenantId, args)),
            create: (args: any) => (prisma as any).historicalEvent.create({ ...args, data: { ...args.data, tenantId } }),
            count: (args?: any) => (prisma as any).historicalEvent.count(withTenant(tenantId, args)),
        },
        bgpLog: {
            findMany: (args?: any) => (prisma as any).bgpLog.findMany(withTenant(tenantId, args)),
            count: (args?: any) => (prisma as any).bgpLog.count(withTenant(tenantId, args)),
            createMany: (args: any) => (prisma as any).bgpLog.createMany({ ...args, data: args.data.map((d: any) => ({ ...d, tenantId })) }),
            deleteMany: (args?: any) => (prisma as any).bgpLog.deleteMany(withTenant(tenantId, args)),
        },
        appSettings: {
            findMany: (args?: any) => (prisma as any).appSettings.findMany(withTenant(tenantId, args)),
            findFirst: (args?: any) => (prisma as any).appSettings.findFirst(withTenant(tenantId, args)),
            upsert: (args: any) => (prisma as any).appSettings.upsert({
                ...args,
                where: { tenantId_key: { tenantId, key: args.where?.key } },
                create: { ...args.create, tenantId },
                update: args.update,
            }),
            deleteMany: (args?: any) => (prisma as any).appSettings.deleteMany(withTenant(tenantId, args)),
        },
        appUser: {
            findMany: (args?: any) => (prisma as any).appUser.findMany(withTenant(tenantId, args)),
            findFirst: (args?: any) => (prisma as any).appUser.findFirst(withTenant(tenantId, args)),
            count: (args?: any) => (prisma as any).appUser.count(withTenant(tenantId, args)),
            create: (args: any) => (prisma as any).appUser.create({ ...args, data: { ...args.data, tenantId } }),
            update: (args: any) => (prisma as any).appUser.updateMany(withTenant(tenantId, args)),
            delete: (args: any) => (prisma as any).appUser.deleteMany(withTenant(tenantId, args)),
        },
    };
}

export type ScopedDb = ReturnType<typeof scopedDb>;
