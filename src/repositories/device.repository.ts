import { prisma } from '@/lib/prisma';
import { scopedDb } from '@/lib/scoped-db';

export class DeviceRepository {
    static async getDeviceByIdAndTenant(id: number, tenantId: string) {
        return (prisma as any).routerDevice.findFirst({ where: { id, tenantId } });
    }

    static async createDevice(tenantId: string, data: any) {
        return scopedDb(tenantId).routerDevice.create({ data });
    }

    static async updateDevice(id: number, data: any) {
        return (prisma as any).routerDevice.update({ where: { id }, data });
    }

    static async deleteDevice(id: number) {
        return (prisma as any).routerDevice.delete({ where: { id } });
    }

    static async upsertSshCredential(tenantId: string, deviceIp: string, data: any, updateData: any) {
        return (prisma as any).deviceCredential.upsert({
            where: { tenantId_deviceIp: { tenantId, deviceIp } },
            create: { tenantId, deviceIp, ...data },
            update: updateData,
        });
    }

    static async updateSshCredential(id: number, data: any) {
        return (prisma as any).deviceCredential.update({
            where: { id },
            data
        });
    }
}
