import { DeviceCredential } from '@prisma/client';
import { SshPoller } from './ssh';
import { TelnetPoller } from './telnet';

export interface ICliPoller {
    exec(command: string, timeoutMs?: number): Promise<string>;
}

export function createCliPoller(ip: string, creds: DeviceCredential, pollMethod: string): ICliPoller {
    if (pollMethod === 'telnet_only' || pollMethod === 'snmp_telnet_mix') {
        return new TelnetPoller(ip, creds);
    }
    return new SshPoller(ip, creds);
}
