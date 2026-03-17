import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/auth';
import { backupRouterConfigs } from '@/worker/config-backup';

export const dynamic = 'force-dynamic';

// Trigger backup for ALL or specific devices on-demand
export async function POST(req: NextRequest) {
    try {
        const session = await requireSession();
        if (!session.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Jalankan background asinkron tanpa harus ditunggu agar API tidak timeout
        // (Bisa diperbaiki agar bisa select 1 ID device di config-backup worker, 
        //  sementara ini `backupRouterConfigs` me-looping *semua* alat).
        backupRouterConfigs().catch(e => console.error('Manual Backup Async Error:', e));

        return NextResponse.json({ success: true, message: 'Configuration backup job triggered asynchronously in background.' }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
