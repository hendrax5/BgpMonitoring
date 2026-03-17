import { Client } from 'ssh2';

async function execSsh(ip: string, cred: any, cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        let out = '';
        conn.on('ready', () => {
            conn.exec(cmd, (err: any, stream: any) => {
                if (err) return resolve('Err: ' + err.message);
                stream.on('data', (d: any) => out += d.toString());
                stream.stderr.on('data', (d: any) => out += d.toString());
                stream.on('close', () => {
                    conn.end();
                    resolve(out);
                });
            });
        }).on('error', (err: any) => resolve('ConnErr: ' + err.message))
        .connect({
            host: ip,
            port: cred.sshPort,
            username: cred.sshUser,
            password: cred.sshPass,
            readyTimeout: 10000,
        });
    });
}

async function main() {
    const devices = [
        { ipAddress: '10.222.2.141', vendor: 'danos', sshCredential: { sshPort: 22, sshUser: 'danos', sshPass: '!Tahun2024' } },
        { ipAddress: '123.108.8.254', vendor: 'vyos', sshCredential: { sshPort: 22, sshUser: 'vyos', sshPass: '!Tahun2024' } }
    ];
    
    for (const dev of devices) {
        console.log(`\n======== Testing ${dev.vendor} ${dev.ipAddress} ========`);
        try {
            if (dev.vendor === 'vyos') {
                const out1 = await execSsh(dev.ipAddress, dev.sshCredential, '/opt/vyatta/bin/vyatta-op-cmd-wrapper show ip bgp summary');
                console.log('--- VYOS SUMMARY ---\n', out1.trim());
                const out2 = await execSsh(dev.ipAddress, dev.sshCredential, '/opt/vyatta/bin/vyatta-op-cmd-wrapper show ip bgp neighbors');
                console.log('--- VYOS NEIGHBORS ---\n', out2.substring(0, 1500));
            } else {
                const out1 = await execSsh(dev.ipAddress, dev.sshCredential, '/opt/vyatta/bin/vyatta-op-cmd-wrapper show protocols bgp ipv4 unicast summary');
                console.log('--- DANOS SUMMARY ---\n', out1.trim());
                const out2 = await execSsh(dev.ipAddress, dev.sshCredential, '/opt/vyatta/bin/vyatta-op-cmd-wrapper show protocols bgp ipv4 unicast neighbors');
                console.log('--- DANOS NEIGHBORS ---\n', out2.substring(0, 1500));
            }
        } catch (e) {
            console.error(e);
        }
    }
}
main();
