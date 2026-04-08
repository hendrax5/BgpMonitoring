const net = require('net');
const fs = require('fs');

const log = (msg) => {
    fs.appendFileSync('/tmp/ruijie_test.log', msg + '\n');
    console.log(msg);
};

fs.writeFileSync('/tmp/ruijie_test.log', '=== TEST START ===\n');

const client = net.createConnection({ host: '103.162.16.105', port: 23 }, () => {
    log('Connected to Ruijie');
    setTimeout(() => {
        log('3s passed. Writing \\r\\n to wake it up...');
        client.write('\r\n');
    }, 3000);
});

client.on('data', (d) => {
    log('RECV RAW: ' + d.toString('hex'));
    log('RECV STR: ' + d.toString('utf8'));
});

client.on('end', () => log('Socket Ends'));
client.on('error', (e) => log('Error: ' + e));

setTimeout(() => {
    log('10s timeout. Exiting.');
    client.destroy();
}, 10000);
