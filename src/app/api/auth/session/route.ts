import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const session = await requireSession();
        if (!session.tenantId) {
            return NextResponse.json({ error: 'Unauthorized', role: 'viewer' }, { status: 401 });
        }

        return NextResponse.json({ 
            user_id: session.userId,
            tenant_id: session.tenantId,
            role: (session.role || 'viewer').toLowerCase()
        }, { status: 200 });

    } catch (e: any) {
        return NextResponse.json({ error: e.message, role: 'viewer' }, { status: 500 });
    }
}
