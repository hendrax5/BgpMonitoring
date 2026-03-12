'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export async function login(formData: FormData) {
    const username = formData.get('username') as string
    const password = formData.get('password') as string

    if (!username || !password) return { error: 'Username and password required' }

    // Check if any users exist, if not, create default admin
    const userCount = await prisma.appUser.count()
    if (userCount === 0) {
        console.log("No users found in database. Creating default 'admin' user.")
        const hashedPassword = await bcrypt.hash('password123', 10)
        await prisma.appUser.create({
            data: { username: 'admin', password: hashedPassword }
        })
    }

    const user = await prisma.appUser.findUnique({
        where: { username }
    })

    if (!user) return { error: 'Invalid username or password' }

    const isValid = await bcrypt.compare(password, user.password)
    
    if (isValid) {
        const cookieStore = await cookies()
        cookieStore.set('auth_token', 'authenticated', {
            httpOnly: true,
            maxAge: 60 * 60 * 24 // 1 day
        })

        redirect('/')
    }

    return { error: 'Invalid username or password' }
}

export async function logout() {
    const cookieStore = await cookies()
    cookieStore.delete('auth_token')
    redirect('/login')
}
