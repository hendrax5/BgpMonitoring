'use server'

import { prisma } from '@/lib/prisma';
import { signToken, setSessionCookie, clearSessionCookie, requireSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';

export async function login(formData: FormData) {
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!username || !password) return { error: 'Username and password required' };

    // Find user — superadmin can log in without tenant slug
    const user = await (prisma as any).appUser.findFirst({
        where: { username },
        include: { tenant: { select: { id: true, slug: true, name: true } } }
    });

    if (!user) return { error: 'Invalid username or password' };

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return { error: 'Invalid username or password' };

    const token = await signToken({
        userId: user.id,
        tenantId: user.tenantId,
        username: user.username,
        role: user.role as 'superadmin' | 'orgadmin' | 'viewer',
    });

    await setSessionCookie(token);
    redirect('/');
}

export async function logout() {
    await clearSessionCookie();
    redirect('/login');
}

/** Register a new tenant + first orgadmin user */
export async function register(formData: FormData) {
    const orgName = formData.get('orgName') as string;
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;

    if (!orgName || !username || !password) return { error: 'All fields required' };
    if (password.length < 8) return { error: 'Password must be at least 8 characters' };

    // Generate slug from org name
    const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    // Check slug unique
    const existing = await (prisma as any).tenant.findUnique({ where: { slug } });
    if (existing) return { error: 'Organization name already taken' };

    const hashedPassword = await bcrypt.hash(password, 12);

    // Create tenant + admin user in a transaction
    await (prisma as any).tenant.create({
        data: {
            name: orgName,
            slug,
            users: {
                create: {
                    username,
                    password: hashedPassword,
                    role: 'orgadmin',
                }
            }
        }
    });

    // Auto-login after register
    const user = await (prisma as any).appUser.findFirst({ where: { username, tenant: { slug } } });
    if (!user) return { error: 'Registration failed' };

    const token = await signToken({
        userId: user.id,
        tenantId: user.tenantId,
        username: user.username,
        role: 'orgadmin',
    });

    await setSessionCookie(token);
    redirect('/');
}

/** Create a new user within the current tenant (orgadmin only) */
export async function createUser(formData: FormData) {
    const session = await requireSession();
    if (session.role !== 'superadmin' && session.role !== 'orgadmin') {
        return { error: 'Unauthorized' };
    }

    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    const role = formData.get('role') as string;
    const email = formData.get('email') as string | null;

    if (!username || !password || !role) return { error: 'All fields required' };
    if (!['orgadmin', 'viewer'].includes(role)) return { error: 'Invalid role' };

    const hashedPassword = await bcrypt.hash(password, 12);

    try {
        await (prisma as any).appUser.create({
            data: {
                tenantId: session.tenantId,
                username,
                email: email || null,
                password: hashedPassword,
                role,
            }
        });
        return { success: true };
    } catch {
        return { error: 'Username already exists' };
    }
}

/** Delete a user (orgadmin only, cannot delete self) */
export async function deleteUser(userId: number) {
    const session = await requireSession();
    if (session.role !== 'superadmin' && session.role !== 'orgadmin') {
        return { error: 'Unauthorized' };
    }
    if (userId === session.userId) return { error: 'Cannot delete yourself' };

    await (prisma as any).appUser.deleteMany({
        where: { id: userId, tenantId: session.tenantId }
    });
    return { success: true };
}
