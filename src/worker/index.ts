import cron from 'node-cron';
import { forceSyncLibreNMS } from './sync';
import { startSyslogServer } from './syslog';
import { backupRouterConfigs } from './config-backup';

// Configuration
const CRON_SCHEDULE = '*/1 * * * *'; // Every minute for development (change to */5 for production)
const BACKUP_SCHEDULE = '0 0 * * *'; // Every midnight 00:00

async function runWorker() {
    await forceSyncLibreNMS('Worker');
}

// Start Cron
console.log(`BGP Worker started with schedule: ${CRON_SCHEDULE}`);
cron.schedule(CRON_SCHEDULE, runWorker);

console.log(`Configuration Backup Worker scheduled: ${BACKUP_SCHEDULE}`);
cron.schedule(BACKUP_SCHEDULE, backupRouterConfigs);

// Start UDP Syslog Server
startSyslogServer();

// Run immediately on boot
runWorker();
