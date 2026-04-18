import bcrypt from 'bcryptjs';
import { UserRepository } from '@/repositories/user.repository';

export class UserService {
    static async createUser({ username, password, requestedRole, tenantId }: any) {
        if (!username || !password) {
            throw new Error('Username and password required');
        }

        const role = requestedRole === 'superadmin' ? 'viewer' : (requestedRole || 'viewer');
        const hashedPassword = await bcrypt.hash(password, 10);

        try {
            return await UserRepository.create({
                username,
                password: hashedPassword,
                role,
                tenantId
            });
        } catch (e: any) {
            if (e.code === 'P2002') throw new Error('Username already exists');
            throw new Error('Error creating user');
        }
    }

    static async updateUser({ id, username, password, tenantId }: any) {
        if (!id || !username) {
            throw new Error('Invalid data');
        }

        const data: any = { username };
        if (password) {
            data.password = await bcrypt.hash(password, 10);
        }

        try {
            return await UserRepository.updateMany({ id, tenantId }, data);
        } catch (e: any) {
            if (e.code === 'P2002') throw new Error('Username already exists');
            throw new Error('Error updating user');
        }
    }

    static async deleteUser({ id, tenantId }: any) {
        try {
            const count = await UserRepository.countByTenant(tenantId);
            if (count <= 1) {
                throw new Error('Cannot delete the last remaining user');
            }
            return await UserRepository.deleteMany({ id, tenantId });
        } catch (e: any) {
            if (e.message === 'Cannot delete the last remaining user') throw e;
            throw new Error('Error deleting user');
        }
    }

    static async updatePassword({ id, newPassword }: any) {
        if (!newPassword || newPassword.length < 4) {
            throw new Error('Password must be at least 4 characters.');
        }

        try {
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            return await UserRepository.updateById(id, { password: hashedPassword });
        } catch (e: any) {
            throw new Error('Error updating password');
        }
    }
}
