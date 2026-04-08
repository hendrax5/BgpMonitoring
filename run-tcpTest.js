const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
const scriptContent = fs.readFileSync('tcpTest.js', 'utf8');

const cmd = `cat << 'EOF' > /tmp/tcpTest.js\n${scriptContent.replace(/\$/g, '\\$')}\nEOF\necho '!Tahun2026' | sudo -S docker cp /tmp/tcpTest.js librenms_dashboard:/app/tcpTest.js\necho '!Tahun2026' | sudo -S docker exec librenms_dashboard node /app/tcpTest.js\n`;

conn.on('ready', () => {
    conn.exec(cmd, (err, stream) => {
        stream.pipe(process.stdout);
        stream.stderr.pipe(process.stderr);
        stream.on('close', () => conn.end());
    });
}).connect({ host: '103.162.17.179', port: 22, username: 'hendra', password: '!Tahun2026' });
