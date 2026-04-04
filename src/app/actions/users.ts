'use server';

import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function addUser(formData: FormData) {
    const session = await requireSession();
    if (!can(session.role, 'user.manageTenant')) return { error: 'Permission denied.' };
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const requestedRole = (formData.get('role') as string) || 'viewer';
    // Never allow assigning superadmin via UI
    const role = requestedRole === 'superadmin' ? 'viewer' : requestedRole;

    if (!username || !password) return { error: 'Username and password required' };

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await (prisma as any).appUser.create({
            data: { username, password: hashedPassword, role, tenantId: session.tenantId }
        });
        revalidatePath('/settings');
    } catch (e: any) {
        if (e.message && e.message.includes('NEXT_REDIRECT')) throw e;
        if (e.code === 'P2002') return { error: 'Username already exists' };
        return { error: 'Error creating user' };
    }
    redirect('/settings');
}

export async function updateUser(formData: FormData) {
    const session = await requireSession();
    if (!can(session.role, 'user.manageTenant')) return { error: 'Permission denied.' };

    const id = parseInt(formData.get('id') as string);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!id || !username) return { error: 'Invalid data' };

    try {
        const data: any = { username };
        if (password) data.password = await bcrypt.hash(password, 10);

        // Ensure update is scoped to this tenant
        await (prisma as any).appUser.updateMany({
            where: { id, tenantId: session.tenantId },
            data
        });
        revalidatePath('/settings');
    } catch (e: any) {
        if (e.message && e.message.includes('NEXT_REDIRECT')) throw e;
        if (e.code === 'P2002') return { error: 'Username already exists' };
        return { error: 'Error updating user' };
    }
    redirect('/settings');
}

export async function deleteUser(id: number) {
    const session = await requireSession();
    if (!can(session.role, 'user.manageTenant')) return { error: 'Permission denied.' };

    try {
        const count = await (prisma as any).appUser.count({ where: { tenantId: session.tenantId } });
        if (count <= 1) return { error: 'Cannot delete the last remaining user' };

        await (prisma as any).appUser.deleteMany({ where: { id, tenantId: session.tenantId } });
        revalidatePath('/settings');
    } catch (e: any) {
        if (e.message && e.message.includes('NEXT_REDIRECT')) throw e;
        return { error: 'Error deleting user' };
    }
    redirect('/settings');
}

export async function updateMyProfile(formData: FormData) {
    const session = await requireSession();
    const newPassword = formData.get('newPassword') as string;
    
    if (!newPassword || newPassword.length < 4) {
        return { error: 'Password must be at least 4 characters.' };
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await (prisma as any).appUser.update({
            where: { id: session.userId },
            data: { password: hashedPassword }
        });
        revalidatePath('/settings');
    } catch (e: any) {
        return { error: 'Error updating password' };
    }
    redirect('/settings?tab=profile&success=1');
}
