const { Client } = require('ssh2');
const conn = new Client();
conn.on('ready', () => {
    conn.exec("echo '!Tahun2026' | sudo -S docker exec librenms_dashboard nc -zv 103.162.16.105 23", (err, stream) => {
        stream.pipe(process.stdout);
        stream.stderr.pipe(process.stderr);
        stream.on('close', () => conn.end());
    });
}).connect({ host: '103.162.17.179', port: 22, username: 'hendra', password: '!Tahun2026' });
