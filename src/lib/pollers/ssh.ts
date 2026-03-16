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
     *
     * Two-layer timeout strategy:
     *   1. connTimer (15s, fixed) — fires if TCP connect or SSH handshake hangs.
     *      Prevents the Promise from hanging forever when a firewall drops SYN packets.
     *   2. cmdTimer (timeoutMs, starts after 'ready') — fires if the SSH command
     *      itself takes too long. Auth delay (TACACS/RADIUS) does NOT consume this budget.
     */
    async exec(command: string, timeoutMs = 15000): Promise<string> {
        const CONN_TIMEOUT_MS = 15000; // TCP + SSH handshake deadline

        return new Promise((resolve, reject) => {
            const conn = new Client();
            let output = '';
            let settled = false;
            let connTimer: ReturnType<typeof setTimeout> | null = null;
            let cmdTimer:  ReturnType<typeof setTimeout> | null = null;

            function cleanup() {
                if (connTimer) { clearTimeout(connTimer); connTimer = null; }
                if (cmdTimer)  { clearTimeout(cmdTimer);  cmdTimer  = null; }
                try { conn.end(); } catch { /* ignore */ }
            }

            function fail(err: Error) {
                if (settled) return;
                settled = true;
                cleanup();
                reject(err);
            }

            function succeed(output: string) {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(output);
            }

            // Layer 1: connection + handshake guard (fixed 15s)
            connTimer = setTimeout(() => {
                fail(new Error(`SSH connection timeout (${CONN_TIMEOUT_MS}ms) — TCP/handshake hung for ${this.ip}`));
            }, CONN_TIMEOUT_MS);

            conn.on('ready', () => {
                // Connection succeeded — switch to command timer
                if (connTimer) { clearTimeout(connTimer); connTimer = null; }

                // Layer 2: command execution guard (starts after auth)
                cmdTimer = setTimeout(() => {
                    fail(new Error(`SSH timeout (${timeoutMs}ms) executing: ${command}`));
                }, timeoutMs);

                conn.exec(command, (err, stream) => {
                    if (err) { fail(err); return; }

                    stream.on('data', (chunk: Buffer) => { output += chunk.toString(); });
                    stream.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });
                    stream.on('close', () => { succeed(output); });
                });
            }).on('error', (err) => {
                fail(err);
            }).connect({
                host: this.ip,
                port: this.creds.sshPort || 22,
                username: this.creds.sshUser,
                password: this.creds.sshPass,
                readyTimeout: 12000,   // ssh2 internal handshake guard (backup)
                hostVerifier: () => true,
            });
        });
    }
}
