const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
conn.on('ready', () => {
    conn.exec("echo '!Tahun2026' | sudo -S docker exec -i librenms_dashboard sh -c 'cat > /tmp/ruijieHack.js && node /tmp/ruijieHack.js'", (err, stream) => {
        const script = `
        const net = require('net');
        function fetchRuijieRaw(host, port, user, pass) {
            return new Promise((resolve, reject) => {
                const client = new net.Socket();
                let output = '';
                let step = 0;
                client.setTimeout(45000);
                client.on('timeout', () => { client.destroy(); reject(new Error('Telnet Timeout Ruijie')); });
                client.on('error', (err) => { reject(err); });
                
                client.connect(port, host, () => {
                    console.log('Connected natively to ' + host);
                    setTimeout(() => client.write('\\r\\n'), 1500);
                });
                
                client.on('data', (data) => {
                    let stripped = Buffer.alloc(data.length);
                    let ptr = 0;
                    for (let i = 0; i < data.length; i++) {
                        if (data[i] === 255) {
                            i += 2; // skip telnet command
                        } else {
                            if (data[i] !== 0) { // filter nulls
                                stripped[ptr++] = data[i];
                            }
                        }
                    }
                    const chunk = stripped.subarray(0, ptr).toString('utf8');
                    output += chunk;
                    
                    if (step === 0 && /(username|login):/i.test(output)) {
                        console.log('Matched Username prompt');
                        step = 1;
                        client.write(user + '\\r\\n');
                        output = '';
                    } else if (step === 1 && /password:/i.test(output)) {
                        console.log('Matched Password prompt');
                        step = 2;
                        client.write(pass + '\\r\\n');
                        output = '';
                    } else if (step === 2 && /(>|#)\s*$/.test(output)) {
                        console.log('Matched Shell prompt, sending show command');
                        step = 3;
                        client.write('terminal length 0\\r\\n');
                        setTimeout(() => client.write('show running-config\\r\\n'), 500);
                        output = '';
                    } else if (step === 3 && output.length > 500 && /(>|#)\s*$/.test(output.trim())) {
                        console.log('Found end of config! Length:', output.length);
                        resolve(output);
                        client.destroy();
                    }
                });
            });
        }
        
        console.log('Starting hack test...');
        fetchRuijieRaw('103.162.16.105', 23, 'hendra', '!Tahun2026').then(cfg => {
            console.log('Success! config length:', cfg.length);
            process.exit(0);
        }).catch(err => {
            console.log('Hack failed:', err);
            process.exit(1);
        });
        `;
        stream.write(script);
        stream.end();
        stream.pipe(process.stdout);
        stream.stderr.pipe(process.stderr);
        stream.on('close', () => conn.end());
    });
}).connect({ host: '103.162.17.179', port: 22, username: 'hendra', password: '!Tahun2026' });
