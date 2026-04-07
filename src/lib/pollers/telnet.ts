import { DeviceCredential } from '@prisma/client';

// @ts-ignore
import { Telnet } from 'telnet-client';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

interface PooledConnection {
    conn: any;
    readyPromise: Promise<any>;
    idleTimer: ReturnType<typeof setTimeout> | null;
}

const pool = new Map<string, PooledConnection>();

export class TelnetPoller {
    constructor(private ip: string, private creds: DeviceCredential) {}

    private getCacheKey(): string {
        return `telnet:${this.ip}:${this.creds.sshPort || 23}:${this.creds.sshUser}`;
    }

    private async getConnection(): Promise<any> {
        const key = this.getCacheKey();
        
        let pooled = pool.get(key);
        if (pooled) {
            if (pooled.idleTimer) clearTimeout(pooled.idleTimer);
            pooled.idleTimer = setTimeout(() => {
                try { pooled?.conn.end(); } catch {}
                pool.delete(key);
            }, IDLE_TIMEOUT_MS);
            return pooled.readyPromise;
        }

        const conn = new Telnet();

        const readyPromise = new Promise<any>(async (resolve, reject) => {
            try {
                // Determine likely shell prompt based on vendor if known
                let promptRegex = />$|#$/;
                if (this.creds.vendor.toLowerCase() === 'mikrotik') promptRegex = />$/;
                
                await conn.connect({
                    host: this.ip,
                    port: this.creds.sshPort || 23,
                    username: this.creds.sshUser,
                    password: this.creds.sshPass,
                    loginPrompt: /([Uu]sername|[Ll]ogin):/i,
                    passwordPrompt: /[Pp]assword:/i,
                    shellPrompt: promptRegex,
                    timeout: 15000,
                    execTimeout: 15000,
                    sendTimeout: 15000,
                    echoLines: -1,
                    negotiationMandatory: false,
                    pageSeparator: /---- More ----/i
                });
                
                resolve(conn);
            } catch (err) {
                pool.delete(key);
                try { conn.end(); } catch {}
                reject(err);
            }
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

        try {
            // By default, telnet-client's exec returns the standard output.
            const out = await conn.exec(command, { execTimeout: timeoutMs });
            return out;
        } catch (err: any) {
            if (err.message && err.message.toLowerCase().includes('close')) {
                pool.delete(this.getCacheKey());
            }
            throw err;
        }
    }
}
