'use server';

import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { revalidatePath } from 'next/cache';

export async function addUser(formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!username || !password) return { error: 'Username and password required' };

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.appUser.create({
            data: { username, password: hashedPassword }
        });
        revalidatePath('/settings');
        return { success: true };
    } catch (e: any) {
        if (e.code === 'P2002') return { error: 'Username already exists' };
        return { error: 'Error creating user' };
    }
}

export async function updateUser(formData: FormData) {
    const id = parseInt(formData.get('id') as string);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    
    if (!id || !username) return { error: 'Invalid data' };

    try {
        const data: any = { username };
        if (password) {
            data.password = await bcrypt.hash(password, 10);
        }

        await prisma.appUser.update({
            where: { id },
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
    try {
        const adminCount = await prisma.appUser.count();
        if (adminCount <= 1) {
            return { error: 'Cannot delete the last remaining user' };
        }
        await prisma.appUser.delete({ where: { id } });
        revalidatePath('/settings');
        return { success: true };
    } catch {
        return { error: 'Error deleting user' };
    }
}
