import { Client } from 'ssh2';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';

// Helper to determine the config command per vendor
function getConfigCommand(vendor: string): string {
    const v = vendor.toLowerCase();
    if (v === 'mikrotik') return 'export';
    if (v === 'huawei') return 'display current-configuration';
    // Default to Cisco / Juniper / VyOS / Danos style. (Some Juniper use 'show configuration | display set')
    if (v === 'juniper') return 'show configuration | display set';
    return 'show running-config';
}

function computeHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}

// Emulate Netmiko/Oxidized prompt handling for VRP Huawei Output Sanitization
function sanitizeHuaweiShellOutput(raw: string): string {
    // 1. Bersihkan semua karakter ANSI komando warna/kontrol terminal
    let clean = raw.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
    let lines = clean.split(/\r?\n/).map(l => l.trimEnd());
    
    // 2. Potong area eksekusi log untuk memastikan hanya menyimpan konfigurasi asli
    const outputLines: string[] = [];
    let isConfigZone = false;

    // Filter baris
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // Deteksi start of config sesudah echo "display current-configuration" terketik
        if (line.includes('display current-configuration') && !isConfigZone) {
            isConfigZone = true;
            continue; 
        }

        if (isConfigZone) {
            // Deteksi end of config (munculnya prompt penutup shell misal <RouterA> atau tulisan perintah 'quit')
            if (line.trim() === 'quit' || (line.startsWith('<') && line.endsWith('>'))) {
                break;
            }
            
            // Singkirkan sisa-sisa jejak paging Huawei "---- More ----"
            if (!line.includes('---- More ----') && !line.includes('more')) {
                outputLines.push(line);
            }
        }
    }

    // Fallback if parsing fails (e.g. echo wasn't caught): return the whole cleaned text minus obvious garbage
    if (outputLines.length === 0) {
        return lines.filter(l => !l.includes('---- More ----') && !l.includes('screen-length')).join('\n');
    }

    return outputLines.join('\n');
}

export async function backupRouterConfigs() {
    console.log('[Config Worker] Starting Configuration Backup Job...');

    const routers = await prisma.routerDevice.findMany({
        include: { sshCredential: true }
    });

    const policies = await prisma.compliancePolicy.findMany({
        where: { isActive: true }
    });

    for (const router of routers) {
        if (!router.sshCredential) {
            console.warn(`[Config Worker] Skipping ${router.hostname} (${router.ipAddress}): No SSH Credentials`);
            continue;
        }

        const cred = router.sshCredential;
        const configCmd = getConfigCommand(router.vendor);

        console.log(`[Config Worker] Connecting to ${router.hostname} (${router.vendor}) to fetch config...`);

        try {
            let configText = await fetchConfigViaSSH(router.ipAddress, cred.sshPort, cred.sshUser, cred.sshPass, configCmd, router.vendor);
            
            // Tambahan sanitasi PTY khusus Huawei
            if (router.vendor.toLowerCase() === 'huawei') {
                configText = sanitizeHuaweiShellOutput(configText);
            }

            const cleanText = configText.replace(/\r\n/g, '\n').trim();
            if (!cleanText || cleanText.length < 10) {
                console.error(`[Config Worker] Parsed config empty/too short for ${router.hostname}. Skip saving.`);
                continue;
            }

            const configHash = computeHash(cleanText);

            const lastBackup = await prisma.deviceConfigBackup.findFirst({
                where: { deviceId: router.id },
                orderBy: { createdAt: 'desc' },
                select: { configHash: true }
            });

            if (lastBackup && lastBackup.configHash === configHash) {
                console.log(`[Config Worker] Skipping ${router.hostname}: Config has not changed since last backup.`);
                continue;
            }

            let isCompliant = true;
            let complianceMsgs: string[] = [];

            for (const policy of policies) {
                const vendorTarget = policy.vendorMatch.toLowerCase();
                if (vendorTarget !== 'all' && vendorTarget !== router.vendor.toLowerCase()) {
                    continue;
                }

                try {
                    const regex = new RegExp(policy.regexPattern, 'im');
                    const isMatched = regex.test(cleanText);
                    
                    if (policy.mustMatch && !isMatched) {
                        isCompliant = false;
                        complianceMsgs.push(`FAIL: [${policy.severity.toUpperCase()}] "${policy.name}" - Missing required config pattern: ${policy.regexPattern}`);
                    } else if (!policy.mustMatch && isMatched) {
                        isCompliant = false;
                        complianceMsgs.push(`FAIL: [${policy.severity.toUpperCase()}] "${policy.name}" - Found forbidden config pattern: ${policy.regexPattern}`);
                    }
                } catch (e) {
                    complianceMsgs.push(`ERROR: Regex failure for policy "${policy.name}"`);
                }
            }

            await prisma.deviceConfigBackup.create({
                data: {
                    tenantId: router.tenantId,
                    deviceId: router.id,
                    configText: cleanText,
                    configHash: configHash,
                    isCompliant: isCompliant,
                    complianceLog: complianceMsgs.join('\n')
                }
            });

            console.log(`[Config Worker] Backup saved for ${router.hostname}. Compliant: ${isCompliant}`);

        } catch (error: any) {
            console.error(`[Config Worker] Failed to fetch config for ${router.hostname}:`, error.message);
        }
    }
    
    console.log('[Config Worker] Configuration Backup Job Finished.');
}

function fetchConfigViaSSH(host: string, port: number, user: string, pass: string, command: string, vendor: string): Promise<string> {
    const v = vendor.toLowerCase();

    // -----------------------------------------------------
    // INTERACTIVE SHELL MODE: Khusus Huawei karena exec VRP menolak non-tty pipes / strings
    // -----------------------------------------------------
    if (v === 'huawei') {
        return new Promise((resolve, reject) => {
            const conn = new Client();
            let output = '';
            
            const timeout = setTimeout(() => {
                conn.end();
                reject(new Error('SSH Shell Connection Timeout (45s)'));
            }, 45000);

            conn.on('ready', () => {
                conn.shell({ term: 'vt100' }, (err, stream) => {
                    if (err) {
                        clearTimeout(timeout);
                        conn.end();
                        return reject(err);
                    }

                    let stagnationTimer: NodeJS.Timeout;

                    stream.on('data', (data: any) => {
                        const chunk = data.toString();
                        output += chunk;

                        // Auto-Space for "---- More ----" paging
                        if (chunk.includes('---- More ----') || chunk.toLowerCase().includes('more')) {
                            stream.write(' ');
                        }

                        // Stagnation Timer: Jika 5 detik tanpa ada bytes baru dari terminal, anggap selesai
                        clearTimeout(stagnationTimer);
                        stagnationTimer = setTimeout(() => {
                            conn.end(); // Akhiri sesi dengan elegan
                        }, 5000);
                    });

                    stream.on('close', () => {
                        clearTimeout(timeout);
                        clearTimeout(stagnationTimer);
                        resolve(output);
                    });

                    // Emulate human keystrokes timeline using \r\n (Carriage Return + Line Feed)
                    setTimeout(() => {
                        stream.write(command + '\r\n');
                        
                        // Mulai deteksi kemandekan data sesudah merilis printah
                        stagnationTimer = setTimeout(() => {
                            conn.end();
                        }, 5000);
                    }, 1500);
                });
            }).on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            }).connect({ host, port, username: user, password: pass, readyTimeout: 15000 });
        });
    }

    // -----------------------------------------------------
    // EXEC MODE: Untuk MikroTik / IOS / VyOS yang mendukung non-interactive batch
    // -----------------------------------------------------
    return new Promise((resolve, reject) => {
        const conn = new Client();
        let output = '';

        const timeout = setTimeout(() => {
            conn.end();
            reject(new Error('SSH Connection Timeout (20s)'));
        }, 20000);

        conn.on('ready', () => {
            conn.exec(command, (err, stream) => {
                if (err) {
                    clearTimeout(timeout);
                    conn.end();
                    return reject(err);
                }
                
                stream.on('data', (data: any) => { output += data.toString(); });
                stream.stderr.on('data', (data: any) => { output += data.toString(); });
                
                stream.on('close', () => {
                    clearTimeout(timeout);
                    conn.end();
                    resolve(output);
                });
            });
        }).on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
        }).connect({ host, port, username: user, password: pass, readyTimeout: 12000 });
    });
}
