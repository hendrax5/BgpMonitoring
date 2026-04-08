const net = require('net');
const client = new net.Socket();
client.setTimeout(10000);
client.connect(23, '103.162.16.105', () => {
    console.log('Connected');
});
client.on('data', (data) => {
    console.log('DATA:', data.toString('utf8'));
});
client.on('close', () => {
    console.log('Connection closed');
});
client.on('error', (err) => {
    console.error('ERROR:', err);
});
