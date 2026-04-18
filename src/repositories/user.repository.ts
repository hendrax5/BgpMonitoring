import { prisma } from '@/lib/prisma';

export class UserRepository {
    static async create(data: any) {
        return (prisma as any).appUser.create({ data });
    }

    static async updateMany(where: any, data: any) {
        return (prisma as any).appUser.updateMany({ where, data });
    }

    static async updateById(id: number, data: any) {
        return (prisma as any).appUser.update({ where: { id }, data });
    }

    static async countByTenant(tenantId: string) {
        return (prisma as any).appUser.count({ where: { tenantId } });
    }

    static async deleteMany(where: any) {
        return (prisma as any).appUser.deleteMany({ where });
    }
}
