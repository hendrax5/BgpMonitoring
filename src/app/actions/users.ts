'use server';

import { requireSession } from '@/lib/auth';
import { can } from '@/lib/rbac';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { UserService } from '@/services/user.service';

export async function addUser(formData: FormData) {
    const session = await requireSession();
    if (!can(session.role, 'user.manageTenant')) return { error: 'Permission denied.' };
    
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const requestedRole = formData.get('role') as string;

    try {
        await UserService.createUser({
            username,
            password,
            requestedRole,
            tenantId: session.tenantId
        });
        revalidatePath('/settings');
    } catch (e: any) {
        if (e.message && e.message.includes('NEXT_REDIRECT')) throw e;
        return { error: e.message || 'Error creating user' };
    }
    redirect('/settings');
}

export async function updateUser(formData: FormData) {
    const session = await requireSession();
    if (!can(session.role, 'user.manageTenant')) return { error: 'Permission denied.' };

    const id = parseInt(formData.get('id') as string);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    try {
        await UserService.updateUser({
            id,
            username,
            password,
            tenantId: session.tenantId
        });
        revalidatePath('/settings');
    } catch (e: any) {
        if (e.message && e.message.includes('NEXT_REDIRECT')) throw e;
        return { error: e.message || 'Error updating user' };
    }
    redirect('/settings');
}

export async function deleteUser(id: number) {
    const session = await requireSession();
    if (!can(session.role, 'user.manageTenant')) return { error: 'Permission denied.' };

    try {
        await UserService.deleteUser({ id, tenantId: session.tenantId });
        revalidatePath('/settings');
    } catch (e: any) {
        if (e.message && e.message.includes('NEXT_REDIRECT')) throw e;
        return { error: e.message || 'Error deleting user' };
    }
    redirect('/settings');
}

export async function updateMyProfile(formData: FormData) {
    const session = await requireSession();
    const newPassword = formData.get('newPassword') as string;
    
    try {
        await UserService.updatePassword({ id: session.userId, newPassword });
        revalidatePath('/settings');
    } catch (e: any) {
        return { error: e.message || 'Error updating password' };
    }
    redirect('/settings?tab=profile&success=1');
}
