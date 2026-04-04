import { NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await requireSession();
        if (session.role !== 'superadmin') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        const tenants = await prisma.tenant.findMany({
            select: {
                id: true,
                name: true
            },
            orderBy: { name: 'asc' }
        });

        return NextResponse.json({ tenants });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
