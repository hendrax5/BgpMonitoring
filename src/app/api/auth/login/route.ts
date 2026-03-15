import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';
import bcrypt from 'bcryptjs';

const COOKIE_NAME = 'bgp_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

/**
 * POST /api/auth/login
 * Sets cookie directly on NextResponse — more reliable than server action
 * cookies().set() behind Traefik/nginx reverse proxies.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { username, password } = body;

        if (!username || !password) {
            return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
        }

        const user = await (prisma as any).appUser.findFirst({
            where: { username },
            include: { tenant: { select: { id: true, slug: true, name: true } } }
        });

        if (!user) {
            return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
        }

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) {
            return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
        }

        const token = await signToken({
            userId: user.id,
            tenantId: user.tenantId,
            username: user.username,
            role: user.role as 'superadmin' | 'orgadmin' | 'viewer',
        });

        // Detect if actual connection is HTTPS (Traefik sets X-Forwarded-Proto)
        // If served over HTTP, Secure flag causes browser to DROP the cookie
        const proto = request.headers.get('x-forwarded-proto') ?? 'http';
        const isHttps = proto === 'https';

        // Set cookie directly on the response object — avoids server action cookie issues
        const response = NextResponse.json({ success: true });
        response.cookies.set(COOKIE_NAME, token, {
            httpOnly: true,
            secure: isHttps, // Only set Secure if actually HTTPS
            sameSite: 'lax',
            maxAge: MAX_AGE,
            path: '/',
        });
        return response;


    } catch (err: any) {
        console.error('[/api/auth/login] Error:', err?.message);
        return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
    }
}
