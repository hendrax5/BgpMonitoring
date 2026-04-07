const { Client } = require('ssh2');
function run() {
  const innerScript = `
const { PrismaClient } = require('@prisma/client');
const { Telnet } = require('telnet-client');

async function testZte() {
  const prisma = new PrismaClient();
  const router = await prisma.routerDevice.findFirst({ where: { hostname: 'OLT.MDP-01' } });
  const creds = await prisma.deviceCredential.findFirst({ where: { id: router.sshCredentialId } });
  const sshUser = creds.sshUser || 'dbn';
  const sshPass = creds.sshPass || 'dbn';
  
  console.log('Connecting to', router.ipAddress, sshUser, sshPass);
  
  const conn = new Telnet();
  
  conn.on('data', (d) => {
    // track bytes size 
  });
  
  try {
     console.log('Attempting connect...');
     await conn.connect({
        host: router.ipAddress,
        port: creds.sshPort || 23,
        username: sshUser,
        password: sshPass,
        loginPrompt: /([Uu]sername|[Ll]ogin):/i,
        passwordPrompt: /[Pp]assword:/i,
        failedLoginMatch: /%Error|bad password|authentication failure/i,
        shellPrompt: /(>|#)\\s*$/,
        timeout: 20000,
        execTimeout: 120000,
        sendTimeout: 20000,
        echoLines: 0,
        negotiationMandatory: true,
        pageSeparator: /---- More.*|Press any key.*/i,
        pageNext: ' '
     });
     console.log('Connect resolved successfully!');
     console.log('Flushing...');
     try { await conn.exec('\\r\\n'); } catch(e){}
     console.log('Executing Paging...');
     try { await conn.exec('terminal length 0'); await new Promise(r=>setTimeout(r,500)); } catch(e){}
     
     console.log('Executing command...');
     const output = await conn.exec('show running-config');
     console.log('FINAL OUTPUT length:', output.length);
     console.log('FIRST 500 chars:', JSON.stringify(output).substring(0, 500));
     conn.end();
  } catch (e) {
     console.log('EXCEPTION:', e.message);
  }
}
testZte().catch(console.error);
  `;
  const cmd = `echo "!Tahun2026" | sudo -S sh -c "docker exec librenms_dashboard sh -c \\"cat << 'EOF' > /app/test-zte.js
${innerScript.replace(/\$/g, '\\$')}
EOF
npx tsx /app/test-zte.js\\""`;
  const conn = new Client();
  conn.on('ready', () => {
    conn.exec(cmd, (err, stream) => {
      if (err) throw err;
      stream.on('close', (code, signal) => {
        conn.end();
      }).on('data', (data) => {
        process.stdout.write(data);
      }).stderr.on('data', (data) => {
        process.stderr.write(data);
      });
    });
  }).connect({
    host: '103.162.17.179',
    port: 22,
    username: 'hendra',
    password: '!Tahun2026'
  });
}
run();
