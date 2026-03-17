const { Client } = require('ssh2');

const host = process.argv[2];
const port = parseInt(process.argv[3] || '22');
const username = process.argv[4];
const password = process.argv[5];

if (!host || !username || !password) {
    console.error('Usage: node test-huawei.js <ip> <port> <user> <pass>');
    process.exit(1);
}

console.log(`Connecting to ${host}:${port} as ${username}...`);

const conn = new Client();

conn.on('ready', () => {
    console.log('Client :: ready. Opening shell...');
    conn.shell({ term: 'vt100' }, (err, stream) => {
        if (err) throw err;
        
        console.log('Shell :: open');
        
        stream.on('close', () => {
            console.log('Stream :: close');
            conn.end();
        });
        
        stream.on('data', (data) => {
            const str = data.toString();
            console.log('--- RECV STREAM ---');
            console.log(str);
            console.log('-------------------');
            
            if (str.includes('---- More ----') || str.toLowerCase().includes('more')) {
                console.log('-> AUTO SENDING SPACE');
                stream.write(' ');
            }
        });

        setTimeout(() => {
            console.log('-> SENDING display current-configuration');
            stream.write('display current-configuration\r\n');
            
            setTimeout(() => {
                console.log('-> SENDING quit');
                stream.write('quit\r\n');
            }, 10000);
        }, 2000);
    });
}).on('error', (err) => {
    console.error('Client :: error', err);
}).connect({
    host,
    port,
    username,
    password,
    readyTimeout: 15000
});
