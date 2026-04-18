import { describe, it, expect, vi, beforeEach } from 'vitest';
import { UserService } from './user.service';
import { UserRepository } from '@/repositories/user.repository';
import bcrypt from 'bcryptjs';

vi.mock('@/repositories/user.repository');
vi.mock('bcryptjs');

describe('UserService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should create a user with a hashed password', async () => {
        const mockUser = { id: 1, username: 'testuser', role: 'viewer', tenantId: 'tenant1' };
        vi.mocked(bcrypt.hash).mockResolvedValue('hashedpass' as never);
        vi.mocked(UserRepository.create).mockResolvedValue(mockUser as never);

        const result = await UserService.createUser({
            username: 'testuser',
            password: 'password123',
            requestedRole: 'viewer',
            tenantId: 'tenant1'
        });

        expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
        expect(UserRepository.create).toHaveBeenCalledWith({
            username: 'testuser',
            password: 'hashedpass',
            role: 'viewer',
            tenantId: 'tenant1'
        });
        expect(result).toEqual(mockUser);
    });

    it('should throw an error if username already exists (P2002)', async () => {
        vi.mocked(bcrypt.hash).mockResolvedValue('hashedpass' as never);
        vi.mocked(UserRepository.create).mockRejectedValue({ code: 'P2002' });

        await expect(UserService.createUser({
            username: 'testuser',
            password: 'password123',
            requestedRole: 'viewer',
            tenantId: 'tenant1'
        })).rejects.toThrow('Username already exists');
    });

    it('should prevent deleting the last remaining user', async () => {
        vi.mocked(UserRepository.countByTenant).mockResolvedValue(1 as never);

        await expect(UserService.deleteUser({ id: 1, tenantId: 'tenant1' }))
            .rejects.toThrow('Cannot delete the last remaining user');

        expect(UserRepository.deleteMany).not.toHaveBeenCalled();
    });
});
