import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireSession } from '@/lib/auth';
import { Client } from 'ssh2';

export const dynamic = 'force-dynamic';

function getRestoreCommand(vendor: string, configText: string): string {
    // Basic restore commands skeleton. Real environments might need FTP/SCP approach or terminal emulation
    // Ini adalah prototype injeksi command per Baris untuk Cisco & VyOS. Huawei/MikroTik bsok lebih rumit (via files)
    const v = vendor.toLowerCase();
    
    // Untuk safety karena restore text dari nodeJS rentan putus, sering kali digunakan expect script / scp.
    // Pada script ini, kami memecah teks ke array of command
    return configText;
}

export async function POST(req: NextRequest) {
    try {
        const session = await requireSession();
        if (!session.tenantId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Cek Role RBAC - Hanya orgadmin dan superadmin
        if (session.role !== 'superadmin' && session.role !== 'orgadmin') {
            return NextResponse.json({ error: 'Forbidden: You do not have permission to restore configs (Required: OrgAdmin/SuperAdmin)' }, { status: 403 });
        }

        const { backupId } = await req.json();
        
        if (!backupId) {
            return NextResponse.json({ error: 'Missing backupId' }, { status: 400 });
        }

        const backup = await prisma.deviceConfigBackup.findUnique({
            where: { id: backupId },
            include: {
                routerDevice: {
                    include: { sshCredential: true }
                }
            }
        });

        if (!backup) return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
        if (backup.routerDevice.tenantId !== session.tenantId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        if (!backup.routerDevice.sshCredential) {
            return NextResponse.json({ error: 'No SSH credential configures on this device' }, { status: 400 });
        }

        const device = backup.routerDevice;
        const cred = device.sshCredential!;
        const textToRestore = backup.configText;
        
        const commandsToRun = textToRestore.split('\n').filter((l: string) => l.trim() !== '' && !l.startsWith('!'));

        // ============================================
        // RESTORE LOGIC VIA SSH 
        // Note: For production, injecting 1000 lines line-by-line via Exec can break buffers
        // Best approach is transfering .cfg file and doing "copy startup-config"
        // But for prototype, we send it through commands.
        // ============================================
        
        return new Promise<NextResponse>((resolve) => {
            const conn = new Client();
            const timeout = setTimeout(() => {
                conn.end();
                resolve(NextResponse.json({ error: 'SSH connection timed out' }, { status: 504 }));
            }, 30000);

            conn.on('ready', () => {
                // Cisco-like enter config mode
                const prepCmd = device.vendor.toLowerCase() === 'mikrotik' ? '' 
                    : device.vendor.toLowerCase() === 'huawei' ? 'system-view\n' 
                    : 'configure terminal\n';
                
                // Inject full text. (We use shell instead of exec for interactive prompt if needed, but exec is safer if router accepts stdin streams)
                conn.exec(prepCmd + textToRestore + '\ncommit\nend\nwrite memory\n', (err, stream) => {
                    if (err) {
                        clearTimeout(timeout);
                        conn.end();
                        resolve(NextResponse.json({ error: err.message }, { status: 500 }));
                        return;
                    }
                    let out = '';
                    stream.on('data', (d: any) => out += d.toString());
                    stream.on('close', () => {
                        clearTimeout(timeout);
                        conn.end();
                        resolve(NextResponse.json({ success: true, message: 'Restore executed successfully via SSH stream.' }, { status: 200 }));
                    });
                });
            }).on('error', (err) => {
                clearTimeout(timeout);
                resolve(NextResponse.json({ error: 'SSH Connection Failed: ' + err.message }, { status: 500 }));
            }).connect({
                host: device.ipAddress,
                port: cred.sshPort,
                username: cred.sshUser,
                password: cred.sshPass,
                readyTimeout: 10000
            });
        });

    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
