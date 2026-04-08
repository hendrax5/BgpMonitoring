const net = require('net');
const client = net.createConnection({ host: '103.162.16.105', port: 23 }, () => {
    console.log('Connected to Ruijie');
    // Don't write anything immediately, just listen for 3 seconds
    setTimeout(() => {
        console.log('3s passed. Writing \\r\\n to wake it up...');
        client.write('\r\n');
    }, 3000);
});
client.on('data', (d) => {
    console.log('RECV RAW:', d);
    console.log('RECV STR:', d.toString());
});
client.on('end', () => console.log('Socket Ends'));
client.on('error', (e) => console.log('Error:', e));
