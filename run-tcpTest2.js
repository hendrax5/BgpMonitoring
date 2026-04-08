const { Client } = require('ssh2');
const fs = require('fs');

const conn = new Client();
conn.on('ready', () => {
    conn.exec("echo '!Tahun2026' | sudo -S sh -c 'docker exec -i librenms_dashboard sh -c \"cat > /tmp/test.js && node /tmp/test.js\"'", (err, stream) => {
        stream.write(fs.readFileSync('tcpTest2.js'));
        stream.end();
        stream.pipe(process.stdout);
        stream.stderr.pipe(process.stderr);
        stream.on('close', () => conn.end());
    });
}).connect({ host: '103.162.17.179', port: 22, username: 'hendra', password: '!Tahun2026' });
