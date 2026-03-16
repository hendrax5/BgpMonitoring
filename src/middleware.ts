import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify, type JWTPayload } from 'jose';

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'change_this_to_a_very_long_random_secret_key_please'
);

const COOKIE_NAME = 'bgp_session';

const PUBLIC_ROUTES = ['/login'];
const PUBLIC_PREFIXES = ['/_next', '/favicon', '/api/public', '/api/debug-login', '/api/auth'];

/** Build a same-protocol redirect URL to avoid HTTP→HTTPS issues behind Traefik */
function sameProtoRedirect(request: NextRequest, pathname: string): NextResponse {
    // Use nextUrl.clone() which preserves the protocol exactly as Next.js sees it.
    // Do NOT use `new URL(path, request.url)` — request.url may resolve to HTTPS
    // when Traefik sets x-forwarded-proto:https on internal HTTP connections.
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = '';
    return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // /register is disabled — redirect to login here in middleware
    // (avoids server component redirect() which can generate HTTPS URLs)
    if (pathname === '/register' || pathname.startsWith('/register/')) {
        return sameProtoRedirect(request, '/login');
    }

    // Allow public routes and static assets
    const isPublic =
        PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/')) ||
        PUBLIC_PREFIXES.some(p => pathname.startsWith(p)) ||
        pathname.includes('.');

    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!isPublic) {
        if (!token) {
            return sameProtoRedirect(request, '/login');
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
            const response = sameProtoRedirect(request, '/login');
            response.cookies.delete(COOKIE_NAME);
            return response;
        }
    }

    // Redirect authenticated users away from login
    if (pathname === '/login' && token) {
        try {
            await jwtVerify(token, JWT_SECRET);
            return sameProtoRedirect(request, '/');
        } catch {
            // Invalid token — allow access to login
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
