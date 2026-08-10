'use server';

import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { revalidatePath } from 'next/cache';

const MANAGE_ROLES = ['superadmin', 'orgadmin', 'networkengineer'];

type Result = { success: boolean; error?: string };

function parseForm(formData: FormData) {
    const peerIp = (formData.get('peerIp') as string || '').trim();
    const peerName = (formData.get('peerName') as string || '').trim() || null;
    const remoteAsnRaw = (formData.get('remoteAsn') as string || '').trim();
    const localAsnRaw = (formData.get('localAsn') as string || '').trim();
    const addressFamily = (formData.get('addressFamily') as string || 'ipv4-unicast').trim();
    const prefixLimitRaw = (formData.get('prefixLimit') as string || '').trim();
    const prefixList = (formData.get('prefixList') as string || '').trim() || null;
    const routePolicyIn = (formData.get('routePolicyIn') as string || '').trim() || null;
    const routePolicyOut = (formData.get('routePolicyOut') as string || '').trim() || null;
    const password = (formData.get('password') as string || '').trim() || null;
    const description = (formData.get('description') as string || '').trim() || null;
    const adminStatus = (formData.get('adminStatus') as string || 'enabled').trim();
    const deviceIdRaw = (formData.get('deviceId') as string || '').trim();

    return {
        peerIp, peerName, remoteAsnRaw, localAsnRaw, addressFamily,
        prefixLimitRaw, prefixList, routePolicyIn, routePolicyOut,
        password, description, adminStatus, deviceIdRaw,
    };
}

function validate(p: ReturnType<typeof parseForm>): string | null {
    if (!p.peerIp) return 'Peer / Neighbor IP is required.';
    // Basic IPv4/IPv6 sanity check
    const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
    const ipv6 = /^[0-9a-fA-F:]+$/;
    if (!ipv4.test(p.peerIp) && !ipv6.test(p.peerIp)) return 'Peer IP is not a valid IPv4 or IPv6 address.';
    if (!p.remoteAsnRaw) return 'Remote AS number is required.';
    if (!/^\d+$/.test(p.remoteAsnRaw)) return 'Remote AS must be a positive number.';
    if (p.localAsnRaw && !/^\d+$/.test(p.localAsnRaw)) return 'Local AS must be a positive number.';
    if (p.prefixLimitRaw && !/^\d+$/.test(p.prefixLimitRaw)) return 'Prefix limit must be a number.';
    return null;
}

export async function createBgpPeer(formData: FormData): Promise<Result> {
    const session = await requireSession();
    if (!MANAGE_ROLES.includes(session.role)) return { success: false, error: 'Permission denied.' };

    const p = parseForm(formData);
    const err = validate(p);
    if (err) return { success: false, error: err };

    try {
        await (prisma as any).bgpPeer.create({
            data: {
                tenantId: session.tenantId,
                peerIp: p.peerIp,
                peerName: p.peerName,
                remoteAsn: BigInt(p.remoteAsnRaw),
                localAsn: p.localAsnRaw ? BigInt(p.localAsnRaw) : null,
                addressFamily: p.addressFamily,
                prefixLimit: p.prefixLimitRaw ? parseInt(p.prefixLimitRaw, 10) : null,
                prefixList: p.prefixList,
                routePolicyIn: p.routePolicyIn,
                routePolicyOut: p.routePolicyOut,
                password: p.password,
                description: p.description,
                adminStatus: p.adminStatus,
                deviceId: p.deviceIdRaw ? parseInt(p.deviceIdRaw, 10) : null,
            },
        });
        revalidatePath('/bgp-peers');
        return { success: true };
    } catch (e: any) {
        if (e?.code === 'P2002') return { success: false, error: 'A peer with this IP and address-family already exists.' };
        return { success: false, error: e?.message || 'Failed to create BGP peer.' };
    }
}

export async function updateBgpPeer(formData: FormData): Promise<Result> {
    const session = await requireSession();
    if (!MANAGE_ROLES.includes(session.role)) return { success: false, error: 'Permission denied.' };

    const id = parseInt(formData.get('id') as string, 10);
    if (!id) return { success: false, error: 'Missing peer id.' };

    const p = parseForm(formData);
    const err = validate(p);
    if (err) return { success: false, error: err };

    try {
        const result = await (prisma as any).bgpPeer.updateMany({
            where: { id, tenantId: session.tenantId },
            data: {
                peerIp: p.peerIp,
                peerName: p.peerName,
                remoteAsn: BigInt(p.remoteAsnRaw),
                localAsn: p.localAsnRaw ? BigInt(p.localAsnRaw) : null,
                addressFamily: p.addressFamily,
                prefixLimit: p.prefixLimitRaw ? parseInt(p.prefixLimitRaw, 10) : null,
                prefixList: p.prefixList,
                routePolicyIn: p.routePolicyIn,
                routePolicyOut: p.routePolicyOut,
                password: p.password,
                description: p.description,
                adminStatus: p.adminStatus,
                deviceId: p.deviceIdRaw ? parseInt(p.deviceIdRaw, 10) : null,
            },
        });
        if (result.count === 0) return { success: false, error: 'Peer not found.' };
        revalidatePath('/bgp-peers');
        return { success: true };
    } catch (e: any) {
        if (e?.code === 'P2002') return { success: false, error: 'A peer with this IP and address-family already exists.' };
        return { success: false, error: e?.message || 'Failed to update BGP peer.' };
    }
}

export async function deleteBgpPeer(id: number): Promise<Result> {
    const session = await requireSession();
    if (!MANAGE_ROLES.includes(session.role)) return { success: false, error: 'Permission denied.' };
    try {
        await (prisma as any).bgpPeer.deleteMany({ where: { id, tenantId: session.tenantId } });
        revalidatePath('/bgp-peers');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to delete BGP peer.' };
    }
}

export async function toggleBgpPeerStatus(id: number, nextStatus: string): Promise<Result> {
    const session = await requireSession();
    if (!MANAGE_ROLES.includes(session.role)) return { success: false, error: 'Permission denied.' };
    try {
        await (prisma as any).bgpPeer.updateMany({
            where: { id, tenantId: session.tenantId },
            data: { adminStatus: nextStatus },
        });
        revalidatePath('/bgp-peers');
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e?.message || 'Failed to update status.' };
    }
}
