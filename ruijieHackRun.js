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
            setTimeout(() => client.write('\r\n'), 1500); // Wait for negotiation and wake up VTY
        });
        
        client.on('data', (data) => {
            let stripped = Buffer.alloc(data.length);
            let ptr = 0;
            let i = 0;
            while (i < data.length) {
                if (data[i] === 255) {
                    if (data.length > i + 2) i += 3;
                    else i += 1;
                } else {
                    if (data[i] !== 0) { // filter nulls
                        stripped[ptr++] = data[i];
                    }
                    i++;
                }
            }
            const chunk = stripped.subarray(0, ptr).toString('utf8');
            process.stdout.write(chunk); // Echo characters to console exactly as switch sends them!
            output += chunk;
            
            if (step === 0 && /(username|login):/i.test(output)) {
                step = 1;
                console.log('\n[DEBUG] Sending username...');
                client.write(user + '\r\n');
                output = '';
            } else if (step === 1 && /password:/i.test(output)) {
                step = 2;
                console.log('\n[DEBUG] Sending password...');
                client.write(pass + '\r\n');
                output = '';
            } else if (step === 2 && /(>|#)\s*$/.test(output)) {
                step = 3;
                console.log('\n[DEBUG] Disabling pagination...');
                client.write('terminal length 0\r\n');
                setTimeout(() => {
                    console.log('\n[DEBUG] Requesting config...');
                    client.write('show running-config\r\n');
                }, 500);
                output = '';
            } else if (step === 3 && output.length > 500 && /(>|#)\s*$/.test(output.trim())) {
                console.log('\n[DEBUG] Found end of config! Length:', output.length);
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
