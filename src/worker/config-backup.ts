import { Client } from 'ssh2';
import crypto from 'crypto';
import { prisma } from '../lib/prisma';
// @ts-ignore
import { Telnet } from 'telnet-client';

// Helper to determine the config command per vendor (Fallback)
function getConfigCommand(vendor: string): string {
    const v = vendor.toLowerCase();
    if (v === 'mikrotik') return 'export';
    if (v === 'huawei') return 'display current-configuration';
    if (v === 'juniper') return 'show configuration | display set';
    if (v === 'vyos' || v === 'danos') return '/bin/vbash -ic "show configuration commands"';
    return 'show running-config';
}

function computeHash(text: string): string {
    return crypto.createHash('sha256').update(text).digest('hex');
}

// Universal Shell Sanitization
function sanitizeShellOutput(raw: string, command: string, removeRegex?: string | null): string {
    let clean = raw.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
    let lines = clean.split(/\r?\n/).map(l => l.trimEnd());
    
    const outputLines: string[] = [];
    let isConfigZone = false;
    let customRegex = removeRegex ? new RegExp(removeRegex, 'm') : null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        if (line.includes(command) && !isConfigZone) {
            isConfigZone = true;
            continue; 
        }

        if (isConfigZone) {
            // Detect prompts <Sysname> or [Sysname] or 'quit'
            if (line.trim() === 'quit' || (line.startsWith('<') && line.endsWith('>')) || (line.startsWith('[') && line.endsWith(']'))) {
                break;
            }
            
            let skipLine = line.includes('---- More ----') || line.toLowerCase().includes('more') || line.includes('\b');
            if (customRegex && customRegex.test(line)) skipLine = true;
            
            if (!skipLine) {
                outputLines.push(line);
            }
        }
    }

    if (outputLines.length === 0) {
        return lines.filter(l => !l.includes('---- More ----') && !l.includes('screen-length') && !(customRegex && customRegex.test(l))).join('\n');
    }

    return outputLines.join('\n');
}

export async function backupRouterConfigs() {
    console.log('[Config Worker] Starting Configuration Backup Job...');

    const routers = await prisma.routerDevice.findMany({
        where: { isConfigBackup: true },
        include: { sshCredential: true }
    });

    const policies = await prisma.compliancePolicy.findMany({
        where: { isActive: true }
    });

    const vendorProfiles = await prisma.vendorProfile.findMany();
    const vendorMap = new Map();
    vendorProfiles.forEach((vp: any) => vendorMap.set(vp.vendorName.toLowerCase(), vp));

    for (const router of routers) {
        if (!router.sshCredential) {
            console.warn(`[Config Worker] Skipping ${router.hostname} (${router.ipAddress}): No SSH Credentials`);
            continue;
        }

        const cred = router.sshCredential;
        
        // Retrieve dynamic vendor profile or use legacy backoff logic
        const profile = vendorMap.get(router.vendor.toLowerCase());
        const configCmd = profile ? profile.backupCommand : getConfigCommand(router.vendor);
        let connectionMode = profile ? profile.connectionMode : (router.vendor.toLowerCase() === 'huawei' ? 'shell' : 'exec');
        let pagingCmd = profile ? profile.disablePagingCmd : null;
        const removeRegex = profile ? profile.regexRemovePattern : null;
        
        // Auto-override: ZTE OLT needs terminal length 0 to avoid huge pagination delays over telnet
        if (router.vendor.toLowerCase() === 'zte-olt' && !pagingCmd) {
            pagingCmd = 'terminal length 0';
        }
        
        // Auto-override: If the router is explicitly configured to use Telnet for polling, we must use Telnet for backup too
        if (router.pollMethod === 'telnet_only' || router.pollMethod === 'snmp_telnet_mix') {
            connectionMode = 'telnet';
        }

        console.log(`[Config Worker] Connecting to ${router.hostname} (${router.vendor} - ${connectionMode} mode) to fetch config...`);

        try {
            let configText = await fetchConfigViaSSH(router.ipAddress, cred.sshPort, cred.sshUser, cred.sshPass, configCmd, connectionMode, pagingCmd);
            
            console.log(`[Config Worker DEBUG] Raw output size from ${connectionMode}: ${configText?.length} bytes`);
            
            if (connectionMode === 'shell' || connectionMode === 'telnet') {
                configText = sanitizeShellOutput(configText, configCmd, removeRegex);
            }

            const cleanText = configText.replace(/\r\n/g, '\n').trim();
            if (!cleanText || cleanText.length < 10) {
                console.error(`[Config Worker] Parsed config empty/too short for ${router.hostname}. Skip saving. Output was: ${JSON.stringify(configText)}`);
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

function fetchConfigViaSSH(host: string, port: number, user: string, pass: string, command: string, connectionMode: string, pagingCmd: string | null): Promise<string> {

    // -----------------------------------------------------
    // TELNET MODE (For legacy devices)
    // -----------------------------------------------------
    if (connectionMode === 'telnet') {
        return new Promise(async (resolve, reject) => {
            const conn = new Telnet();
            try {
                console.log(`[Config Worker DEBUG] Executing connect() for ${host} using user[${user}]`);
                await conn.connect({
                    host: host,
                    port: port || 23,
                    username: user,
                    password: pass,
                    loginPrompt: /([Uu]sername|[Ll]ogin):/i,
                    passwordPrompt: /[Pp]assword:/i,
                    failedLoginMatch: /%Error|bad password|authentication failure/i,
                    shellPrompt: /(>|#)\s*$/,
                    timeout: 45000,
                    execTimeout: 300000,
                    sendTimeout: 20000,
                    echoLines: 0,
                    negotiationMandatory: true,
                    pageSeparator: /---- More.*|Press any key.*/i,
                    pageNext: ' '
                });
                console.log(`[Config Worker DEBUG] connect() RESOLVED for ${host}`);
                
                // Flush the leftover prompt buffer from connect() by sending an empty return
                try { console.log(`[Config Worker DEBUG] Executing Flush for ${host}`); await conn.exec('\r\n'); } catch (e: any) {
                    console.log(`[Config Worker DEBUG] Flush timeout for ${host}:`, e.message);
                }
                
                if (pagingCmd) {
                    try {
                        console.log(`[Config Worker DEBUG] Executing Paging for ${host}`);
                        await conn.exec(pagingCmd);
                        await new Promise(r => setTimeout(r, 500));
                    } catch (e: any) {
                        console.log(`[Config Worker DEBUG] Paging timeout for ${host}:`, e.message);
                        // Ignore paging command timeout if device doesn't support it or prompt swallowed
                    }
                }
                
                // Execute the actual backup command
                console.log(`[Config Worker DEBUG] Executing Main Command '${command}' for ${host}`);
                const output = await conn.exec(command);
                console.log(`[Config Worker DEBUG] Main Command SUCCESS for ${host}, length:`, output?.length);
                conn.end();
                resolve(output);
            } catch (err) {
                try { conn.end(); } catch {}
                reject(err);
            }
        });
    }

    // -----------------------------------------------------
    // INTERACTIVE SHELL MODE (For devices without EXEC channel support like Huawei/H3C/Ruijie)
    // -----------------------------------------------------
    if (connectionMode === 'shell') {
        return new Promise((resolve, reject) => {
            const conn = new Client();
            let output = '';
            
            const timeout = setTimeout(() => {
                conn.end();
                reject(new Error('SSH Shell Connection Timeout (45s)'));
            }, 45000);

            conn.on('ready', () => {
                conn.shell({ term: 'vt100' }, (err: any, stream: any) => {
                    if (err) {
                        clearTimeout(timeout);
                        conn.end();
                        return reject(err);
                    }

                    let stagnationTimer: NodeJS.Timeout;

                    stream.on('data', (data: any) => {
                        const chunk = data.toString();
                        output += chunk;

                        // Auto-Space for "---- More ----" paging just in case pagingCmd failed
                        if (chunk.includes('---- More ----') || chunk.toLowerCase().includes('more')) {
                            stream.write(' ');
                        }

                        clearTimeout(stagnationTimer);
                        stagnationTimer = setTimeout(() => {
                            conn.end();
                        }, 5000);
                    });

                    stream.on('close', () => {
                        clearTimeout(timeout);
                        clearTimeout(stagnationTimer);
                        resolve(output);
                    });

                    setTimeout(() => {
                        if (pagingCmd) {
                            stream.write(pagingCmd + '\r\n');
                            setTimeout(() => {
                                stream.write(command + '\r\n');
                                stagnationTimer = setTimeout(() => { conn.end(); }, 5000);
                            }, 1000);
                        } else {
                            stream.write(command + '\r\n');
                            stagnationTimer = setTimeout(() => { conn.end(); }, 5000);
                        }
                    }, 1500);
                });
            }).on('error', (err: any) => {
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
            conn.exec(command, (err: any, stream: any) => {
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
        }).on('error', (err: any) => {
            clearTimeout(timeout);
            reject(err);
        }).connect({ host, port, username: user, password: pass, readyTimeout: 12000 });
    });
}
