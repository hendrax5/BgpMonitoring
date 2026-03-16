import { Client } from 'ssh2';
import { DeviceCredential } from '@prisma/client';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface PooledConnection {
    conn: Client;
    readyPromise: Promise<Client>;
    idleTimer: ReturnType<typeof setTimeout> | null;
}

// Global cache to persist connections across multiple polls/requests
const pool = new Map<string, PooledConnection>();

/**
 * SshPoller — wraps the native ssh2 Client with a simple Promise-based exec()
 * Now features Connection Pooling: maintains SSH session for 5 minutes
 * to multiplex multiple commands (fast live events & parallel polls).
 */
export class SshPoller {
    constructor(private ip: string, private creds: DeviceCredential) {}

    private getCacheKey(): string {
        return `${this.ip}:${this.creds.sshPort || 22}:${this.creds.sshUser}`;
    }

    private async getConnection(): Promise<Client> {
        const key = this.getCacheKey();
        
        let pooled = pool.get(key);
        if (pooled) {
            // Reset idle timer since we're reusing it
            if (pooled.idleTimer) clearTimeout(pooled.idleTimer);
            pooled.idleTimer = setTimeout(() => {
                try { pooled?.conn.end(); } catch {}
                pool.delete(key);
            }, IDLE_TIMEOUT_MS);
            
            return pooled.readyPromise;
        }

        const conn = new Client();
        const CONN_TIMEOUT_MS = 15000;

        const readyPromise = new Promise<Client>((resolve, reject) => {
            let connTimer: ReturnType<typeof setTimeout> | null = null;
            let settled = false;

            const cleanup = () => {
                if (connTimer) { clearTimeout(connTimer); connTimer = null; }
            };

            const fail = (err: Error) => {
                if (settled) return;
                settled = true;
                cleanup();
                pool.delete(key);
                try { conn.end(); } catch {}
                reject(err);
            };

            connTimer = setTimeout(() => {
                fail(new Error(`SSH connection timeout (${CONN_TIMEOUT_MS}ms) — TCP/handshake hung for ${this.ip}`));
            }, CONN_TIMEOUT_MS);

            conn.on('ready', () => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(conn);
            }).on('error', (err) => {
                if (!settled) fail(err);
                else {
                    pool.delete(key);
                    try { conn.end(); } catch {}
                }
            }).on('end', () => {
                pool.delete(key);
            }).on('close', () => {
                pool.delete(key);
            }).connect({
                host: this.ip,
                port: this.creds.sshPort || 22,
                username: this.creds.sshUser,
                password: this.creds.sshPass,
                readyTimeout: 12000,
                hostVerifier: () => true,
            });
        });

        pooled = {
            conn,
            readyPromise,
            idleTimer: setTimeout(() => {
                try { conn.end(); } catch {}
                pool.delete(key);
            }, IDLE_TIMEOUT_MS)
        };
        
        pool.set(key, pooled);
        
        return readyPromise;
    }

    async exec(command: string, timeoutMs = 15000): Promise<string> {
        const conn = await this.getConnection();

        return new Promise((resolve, reject) => {
            let output = '';
            let settled = false;
            let cmdTimer: ReturnType<typeof setTimeout> | null = null;
            let execStream: any = null;

            const cleanup = () => {
                if (cmdTimer) { clearTimeout(cmdTimer); cmdTimer = null; }
            };

            cmdTimer = setTimeout(() => {
                if (settled) return;
                settled = true;
                cleanup();
                if (execStream) try { execStream.close(); } catch {}
                reject(new Error(`SSH timeout (${timeoutMs}ms) executing: ${command}`));
            }, timeoutMs);

            conn.exec(command, (err, stream) => {
                if (err) {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    if (err.message && err.message.toLowerCase().includes('close')) {
                        pool.delete(this.getCacheKey());
                    }
                    reject(err);
                    return;
                }

                execStream = stream;

                stream.on('data', (chunk: Buffer) => { output += chunk.toString(); });
                stream.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });
                stream.on('close', () => {
                    if (settled) return;
                    settled = true;
                    cleanup();
                    resolve(output);
                });
            });
        });
    }
}
