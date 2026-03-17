import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const session = await requireSession();
        if (!session.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const policies = await prisma.compliancePolicy.findMany({
            orderBy: { createdAt: 'desc' }
        });

        // Catatan: Walau policy global, OrgAdmin/Viewer boleh melihat list rule-nya untuk paham kenapa device-nya FAIL
        return NextResponse.json({ policies }, { status: 200 });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await requireSession();
        if (!session.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // HANYA SUPERADMIN yang boleh mengubah/menambahkan policy global
        if (session.role !== 'superadmin') {
            return NextResponse.json({ error: 'Forbidden: Only SuperAdmins can modify global compliance policies.' }, { status: 403 });
        }

        const body = await req.json();
        const action = body.action || 'create';

        if (action === 'create' || action === 'update') {
            const { id, name, description, vendorMatch, mustMatch, regexPattern, severity, isActive } = body;
            
            if (!name || !vendorMatch || !regexPattern) {
                return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
            }

            // Validasi format Regex agar tidak crash worker
            try {
                new RegExp(regexPattern);
            } catch (err: any) {
                return NextResponse.json({ error: 'Invalid Regular Expression: ' + err.message }, { status: 400 });
            }

            if (action === 'create') {
                const newPol = await prisma.compliancePolicy.create({
                    data: { name, description, vendorMatch, mustMatch, regexPattern, severity, isActive }
                });
                return NextResponse.json({ policy: newPol }, { status: 201 });
            } else {
                const updPol = await prisma.compliancePolicy.update({
                    where: { id: parseInt(id) },
                    data: { name, description, vendorMatch, mustMatch, regexPattern, severity, isActive }
                });
                return NextResponse.json({ policy: updPol }, { status: 200 });
            }
        } 
        else if (action === 'delete') {
            const { id } = body;
            await prisma.compliancePolicy.delete({ where: { id: parseInt(id) } });
            return NextResponse.json({ success: true }, { status: 200 });
        } else {
            return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
        }

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
