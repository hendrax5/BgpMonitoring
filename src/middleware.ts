import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, type JWTPayload } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'change_this_to_a_very_long_random_secret_key_please'
);

const COOKIE_NAME = 'bgp_session';

const PUBLIC_ROUTES = ['/login', '/register'];
const PUBLIC_PREFIXES = ['/_next', '/favicon', '/api/public'];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public routes and static assets
    const isPublic =
        PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/')) ||
        PUBLIC_PREFIXES.some(p => pathname.startsWith(p)) ||
        pathname.includes('.');

    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!isPublic) {
        if (!token) {
            return NextResponse.redirect(new URL('/login', request.url));
        }

        try {
            const { payload } = await jwtVerify(token, JWT_SECRET) as { payload: JWTPayload & { tenantId: string; role: string } };

            // Inject identity into request headers for downstream use
            const requestHeaders = new Headers(request.headers);
            requestHeaders.set('x-tenant-id', payload.tenantId ?? '');
            requestHeaders.set('x-user-role', payload.role ?? 'viewer');
            requestHeaders.set('x-user-id', String(payload.userId ?? ''));

            return NextResponse.next({ request: { headers: requestHeaders } });
        } catch {
            // Token invalid/expired — clear cookie and redirect
            const response = NextResponse.redirect(new URL('/login', request.url));
            response.cookies.delete(COOKIE_NAME);
            return response;
        }
    }

    // Redirect authenticated users away from login/register
    if ((pathname === '/login' || pathname === '/register') && token) {
        try {
            await jwtVerify(token, JWT_SECRET);
            return NextResponse.redirect(new URL('/', request.url));
        } catch {
            // Invalid token — allow access to login
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
