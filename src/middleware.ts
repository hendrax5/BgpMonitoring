import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
    const authCookie = request.cookies.get('auth_token')
    const { pathname } = request.nextUrl

    // Protect all routes except /login and static assets
    const isPublicRoute = pathname.startsWith('/login') ||
        pathname.startsWith('/_next') ||
        pathname.includes('.')

    const isAuthenticated = authCookie?.value === 'authenticated'

    if (!isPublicRoute && !isAuthenticated) {
        return NextResponse.redirect(new URL('/login', request.url))
    }

    if (pathname === '/login' && isAuthenticated) {
        return NextResponse.redirect(new URL('/', request.url))
    }

    return NextResponse.next()
}

export const config = {
    matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
