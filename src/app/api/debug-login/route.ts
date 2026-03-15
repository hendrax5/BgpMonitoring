import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// TEMPORARY debug endpoint — REMOVE AFTER DEBUGGING
// Access: GET /api/debug-login?u=superadmin
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('u') || 'superadmin';

    const result: Record<string, any> = {
        timestamp: new Date().toISOString(),
        DATABASE_URL: process.env.DATABASE_URL?.replace(/:\/\/.*@/, '://***@') ?? 'NOT_SET',
        NODE_ENV: process.env.NODE_ENV,
    };

    try {
        const user = await (prisma as any).appUser.findFirst({
            where: { username },
            select: { id: true, username: true, role: true, tenantId: true, password: true }
        });
        result.userFound = !!user;
        if (user) {
            result.userId = user.id;
            result.role = user.role;
            result.tenantId = user.tenantId;
            result.passwordHashPrefix = user.password?.slice(0, 10);
        }
        const tenantCount = await (prisma as any).tenant.count();
        const userCount = await (prisma as any).appUser.count();
        result.tenantCount = tenantCount;
        result.userCount = userCount;
    } catch (err: any) {
        result.dbError = err?.message;
    }

    return NextResponse.json(result);
}
