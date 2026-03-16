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
     * timeoutMs applies only to command execution AFTER the connection is ready,
     * so TACACS/RADIUS auth delay does not consume the command timeout budget.
     * Connection establishment has its own readyTimeout (10s).
     */
    async exec(command: string, timeoutMs = 15000): Promise<string> {
        return new Promise((resolve, reject) => {
            const conn = new Client();
            let output = '';
            let timer: ReturnType<typeof setTimeout> | null = null;

            conn.on('ready', () => {
                // Start command timeout AFTER connection + auth succeed.
                // This prevents TACACS/RADIUS auth delay from consuming the budget.
                timer = setTimeout(() => {
                    conn.end();
                    reject(new Error(`SSH timeout (${timeoutMs}ms) executing: ${command}`));
                }, timeoutMs);

                conn.exec(command, (err, stream) => {
                    if (err) {
                        if (timer) clearTimeout(timer);
                        conn.end();
                        reject(err);
                        return;
                    }

                    stream.on('data', (chunk: Buffer) => { output += chunk.toString(); });
                    stream.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });

                    stream.on('close', () => {
                        if (timer) clearTimeout(timer);
                        conn.end();
                        resolve(output);
                    });
                });
            }).on('error', (err) => {
                if (timer) clearTimeout(timer);
                reject(err);
            }).connect({
                host: this.ip,
                port: this.creds.sshPort || 22,
                username: this.creds.sshUser,
                password: this.creds.sshPass,
                readyTimeout: 10000,   // connection + auth timeout (separate from command timeout)
                // Don't fail on unknown host keys (monitoring tool)
                hostVerifier: () => true,
            });
        });
    }
}
