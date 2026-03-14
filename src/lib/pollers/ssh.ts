import { Client } from 'ssh2';
import { DeviceCredential } from '@prisma/client';

/**
 * SshPoller — wraps the native ssh2 Client with a simple Promise-based exec()
 * Replaces ssh2-promise which had a broken @heroku/socksv5 dependency.
 */
export class SshPoller {
    constructor(private ip: string, private creds: DeviceCredential) {}

    /**
     * Connect, run a single command, disconnect, return stdout as string.
     */
    async exec(command: string, timeoutMs = 15000): Promise<string> {
        return new Promise((resolve, reject) => {
            const conn = new Client();
            let output = '';

            const timer = setTimeout(() => {
                conn.end();
                reject(new Error(`SSH timeout (${timeoutMs}ms) executing: ${command}`));
            }, timeoutMs);

            conn.on('ready', () => {
                conn.exec(command, (err, stream) => {
                    if (err) {
                        clearTimeout(timer);
                        conn.end();
                        reject(err);
                        return;
                    }

                    stream.on('data', (chunk: Buffer) => { output += chunk.toString(); });
                    stream.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });

                    stream.on('close', () => {
                        clearTimeout(timer);
                        conn.end();
                        resolve(output);
                    });
                });
            }).on('error', (err) => {
                clearTimeout(timer);
                reject(err);
            }).connect({
                host: this.ip,
                port: this.creds.sshPort || 22,
                username: this.creds.sshUser,
                password: this.creds.sshPass,
                readyTimeout: 8000,
                // Don't fail on unknown host keys (monitoring tool)
                hostVerifier: () => true,
            });
        });
    }
}
