import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'change_this_to_a_very_long_random_secret_key_please'
);

const COOKIE_NAME = 'bgp_session';
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface SessionPayload extends JWTPayload {
    userId: number;
    tenantId: string;
    username: string;
    role: 'superadmin' | 'orgadmin' | 'viewer';
}

/** Sign and return a JWT token */
export async function signToken(payload: SessionPayload): Promise<string> {
    return new SignJWT(payload)
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(JWT_SECRET);
}

/** Verify and decode a JWT token */
export async function verifyToken(token: string): Promise<SessionPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET);
        return payload as SessionPayload;
    } catch {
        return null;
    }
}

/** Get current session from cookie — for use in server components and actions */
export async function getSession(): Promise<SessionPayload | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return verifyToken(token);
}

/** Require session — redirects to /login if not authenticated */
export async function requireSession(): Promise<SessionPayload> {
    const session = await getSession();
    if (!session) redirect('/login');
    return session;
}

/** Require specific role — redirects to / if insufficient access */
export async function requireRole(
    session: SessionPayload,
    allowed: Array<'superadmin' | 'orgadmin' | 'viewer'>
): Promise<void> {
    if (!allowed.includes(session.role)) redirect('/');
}

/** Set session cookie */
export async function setSessionCookie(token: string): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: MAX_AGE,
        path: '/',
    });
}

/** Clear session cookie */
export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}
