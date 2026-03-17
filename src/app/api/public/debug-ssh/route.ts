import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SshPoller } from '@/lib/pollers/ssh';

export const dynamic = 'force-dynamic';

export async function GET() {
    const devices = await (prisma as any).routerDevice.findMany({
        where: { vendor: { in: ['danos', 'vyos'] } },
        include: { sshCredential: true }
    });
    
    let resData = '';
    
    for (const dev of devices) {
        if (!dev.sshCredential) continue;
        resData += `\n======== Testing ${dev.vendor} ${dev.ipAddress} ========\n`;
        const ssh = new SshPoller(dev.ipAddress, dev.sshCredential);
        try {
            if (dev.vendor === 'vyos') {
                const out1 = await ssh.exec('vtysh -c "show ip bgp summary"');
                resData += '--- VYOS SUMMARY ---\n' + out1.trim() + '\n';
                const out2 = await ssh.exec('vtysh -c "show ip bgp neighbors"');
                resData += '--- VYOS NEIGHBORS ---\n' + out2.substring(0, 1500) + '\n';
            } else {
                const out1 = await ssh.exec('/bin/vbash -ic "show protocols bgp ipv4 unicast summary"');
                resData += '--- DANOS SUMMARY ---\n' + out1.trim() + '\n';
                const out2 = await ssh.exec('/bin/vbash -ic "show protocols bgp ipv4 unicast neighbors"');
                resData += '--- DANOS NEIGHBORS ---\n' + out2.substring(0, 1500) + '\n';
            }
        } catch (e: any) {
            resData += `Err: ${e.message}\n`;
        }
    }
    
    return new NextResponse(resData, { headers: { 'Content-Type': 'text/plain' } });
}
