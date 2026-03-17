import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    const devices = await (prisma as any).routerDevice.findMany();
    const creds = await (prisma as any).deviceCredential.findMany();
    return NextResponse.json({ devices, creds });
}
