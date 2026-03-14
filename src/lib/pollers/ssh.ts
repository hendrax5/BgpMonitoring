import SSH2Promise from 'ssh2-promise';
import { DeviceCredential } from '@prisma/client';

export class SshPoller {
    private ssh: any;

    constructor(private ip: string, private creds: DeviceCredential) {
        this.ssh = new SSH2Promise({
            host: this.ip,
            port: this.creds.sshPort || 22,
            username: this.creds.sshUser,
            password: this.creds.sshPass,
            readyTimeout: 5000,
        });
    }

    /**
     * Executes a CLI command and returns the raw string output.
     */
    async exec(command: string): Promise<string> {
        try {
            await this.ssh.connect();
            const output = await this.ssh.exec(command);
            return output ? output.toString() : '';
        } finally {
            this.ssh.close();
        }
    }
}
