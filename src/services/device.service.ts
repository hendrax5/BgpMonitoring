import { DeviceRepository } from '@/repositories/device.repository';
import { redis } from '@/lib/redis';

export class DeviceService {
    static async addDevice(tenantId: string, deviceData: any) {
        const { hostname, ipAddress, vendor, pollMethod, snmpVersion, snmpCommunity, snmpPort, sshUser, sshPass, sshPort, isBgpMonitoring, isConfigBackup } = deviceData;

        if (!hostname || !ipAddress || !vendor || !pollMethod) {
            throw new Error('Hostname, IP Address, Vendor, and Polling Method are required.');
        }

        let sshCredentialId: number | null = null;
        if (sshUser) {
            const cred = await DeviceRepository.upsertSshCredential(tenantId, ipAddress, 
                { sshUser, sshPass, sshPort, vendor },
                { sshUser, sshPort, vendor, ...(sshPass ? { sshPass } : {}) }
            );
            sshCredentialId = cred.id;
        }

        return await DeviceRepository.createDevice(tenantId, {
            hostname, ipAddress, vendor, pollMethod, snmpVersion, snmpCommunity, snmpPort, sshCredentialId, isBgpMonitoring, isConfigBackup
        });
    }

    static async updateDevice(tenantId: string, id: number, deviceData: any) {
        const { hostname, ipAddress, vendor, pollMethod, snmpVersion, snmpCommunity, snmpPort, sshUser, sshPass, sshPort, isBgpMonitoring, isConfigBackup } = deviceData;

        if (!id || !hostname || !ipAddress) {
            throw new Error('Hostname and IP Address are required.');
        }

        const existingRouter = await DeviceRepository.getDeviceByIdAndTenant(id, tenantId);
        if (!existingRouter) throw new Error('Router not found.');

        let sshCredentialId: number | null = existingRouter.sshCredentialId;
        if (sshCredentialId) {
            const updateCredData: any = { sshUser, sshPort, vendor };
            if (sshPass) updateCredData.sshPass = sshPass;
            if (existingRouter.ipAddress !== ipAddress) updateCredData.deviceIp = ipAddress;
            
            await DeviceRepository.updateSshCredential(sshCredentialId, updateCredData);
        } else if (sshUser) {
            const cred = await DeviceRepository.upsertSshCredential(tenantId, ipAddress, 
                { sshUser, sshPass, sshPort, vendor },
                { sshUser, sshPort, vendor, ...(sshPass ? { sshPass } : {}) }
            );
            sshCredentialId = cred.id;
        }

        const updateData = { hostname, ipAddress, vendor, pollMethod, snmpVersion, snmpCommunity, snmpPort, sshCredentialId, isBgpMonitoring, isConfigBackup };

        if (existingRouter.hostname !== hostname || existingRouter.isBgpMonitoring !== isBgpMonitoring) {
            const oldKeys = await redis.keys(`BgpSession:${tenantId}:${existingRouter.hostname}:*`);
            if (oldKeys.length > 0) await redis.del(...oldKeys);
        }

        return await DeviceRepository.updateDevice(id, updateData);
    }

    static async deleteDevice(tenantId: string, id: number) {
        const existing = await DeviceRepository.getDeviceByIdAndTenant(id, tenantId);
        if (existing) {
            const redisKeys = await redis.keys(`BgpSession:${tenantId}:${existing.hostname}:*`);
            if (redisKeys.length > 0) await redis.del(...redisKeys);
            return await DeviceRepository.deleteDevice(id);
        }
        return null;
    }
}
