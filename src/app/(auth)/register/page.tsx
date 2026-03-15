import { redirect } from 'next/navigation';

// Registration is disabled — tenants are created by superadmin only from /admin
export default function RegisterPage() {
    redirect('/login');
}
