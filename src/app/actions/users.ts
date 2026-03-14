'use server';

import { requireSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { can } from '@/lib/rbac';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

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
        return { success: true };
    } catch (e: any) {
        if (e.code === 'P2002') return { error: 'Username already exists' };
        return { error: 'Error creating user' };
    }
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
        return { success: true };
    } catch (e: any) {
        if (e.code === 'P2002') return { error: 'Username already exists' };
        return { error: 'Error updating user' };
    }
}

export async function deleteUser(id: number) {
    const session = await requireSession();
    if (!can(session.role, 'user.manageTenant')) return { error: 'Permission denied.' };

    try {
        const count = await (prisma as any).appUser.count({ where: { tenantId: session.tenantId } });
        if (count <= 1) return { error: 'Cannot delete the last remaining user' };

        await (prisma as any).appUser.deleteMany({ where: { id, tenantId: session.tenantId } });
        revalidatePath('/settings');
        return { success: true };
    } catch {
        return { error: 'Error deleting user' };
    }
}
