const net = require('net');
const client = net.createConnection({ host: '103.162.16.105', port: 23 }, () => {
    console.log('Connected natively to Ruijie from WINDOWS!');
    setTimeout(() => {
        client.write('\r\n');
    }, 1500);
});

client.on('data', (d) => {
    console.log('RECV:', d.toString());
    client.destroy();
});

client.on('error', (err) => {
    console.log('Error:', err.message);
});

client.on('timeout', () => {
    console.log('Timeout!');
});
client.setTimeout(5000);
