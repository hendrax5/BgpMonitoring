const { Client } = require('ssh2');
const conn = new Client();

const remoteScriptCode = `
import { Telnet } from 'telnet-client';
async function test() {
  const conn = new Telnet();
  const params = {
    host: '103.162.16.105', port: 23, username: 'hendra', password: '!Tahun2026',
    loginPrompt: /([Uu]sername|[Ll]ogin):/i, passwordPrompt: /[Pp]assword:/i,
    initialLFFlush: true, shellPrompt: /(>|#)\\s*$/, timeout: 45000, execTimeout: 10000,
    sendTimeout: 20000, echoLines: 0, negotiationMandatory: false, pageSeparator: /---- More.*|Press any key.*/i, pageNext: ' ', debug: true
  };
  try {
    console.log('Connecting...');
    await conn.connect(params);
    console.log('Connected!');
    console.log('Sending flush...');
    let flush = await conn.exec('\\r\\n');
    console.log('Flush output:', JSON.stringify(flush));
    await new Promise(r => setTimeout(r, 2000));
    console.log('Sending disable pagination...');
    let pag = await conn.exec('terminal length 0');
    console.log('Pag output:', JSON.stringify(pag));
    await new Promise(r => setTimeout(r, 2000));
    console.log('Sending show running-config...');
    let out2 = await conn.exec('show running-config');
    console.log('SHOW RUNNING:', JSON.stringify(out2).substring(0, 500));
    conn.end();
  } catch (e) { console.error('Connection failed:', e); }
}
test();
`;

const cmd = `
cat << 'EOF' > /tmp/test-ruijie.ts
${remoteScriptCode.replace(/\$/g, '\\$')}
EOF
echo '!Tahun2026' | sudo -S docker cp /tmp/test-ruijie.ts librenms_dashboard:/app/test-ruijie.ts
echo '!Tahun2026' | sudo -S docker exec -w /app librenms_dashboard npx tsx test-ruijie.ts
`;

conn.on('ready', () => {
  conn.exec(cmd, (err, stream) => {
    if (err) throw err;
    stream.pipe(process.stdout);
    stream.stderr.pipe(process.stderr);
    stream.on('close', () => conn.end());
  });
}).connect({ host: '103.162.17.179', port: 22, username: 'hendra', password: '!Tahun2026' });
