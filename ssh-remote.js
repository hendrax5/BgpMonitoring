const { Client } = require('ssh2');
function run() {
  const cmd = `echo "!Tahun2026" | sudo -S sh -c "cd /home/hendra/BgpMonitoring && git pull && docker compose up -d --build librenms-dashboard && sleep 5 && docker exec librenms_dashboard npx tsx -e \\"import('./src/worker/config-backup.ts').then(m => m.backupRouterConfigs().then(() => process.exit(0)))\\""`;
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
