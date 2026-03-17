import * as cron from 'node-cron';
import { prisma } from '../lib/prisma';
import { forceSyncLibreNMS } from './sync';
import { startSyslogServer } from './syslog';
import { backupRouterConfigs } from './config-backup';

// Configuration
const CRON_SCHEDULE = '*/1 * * * *'; // Every minute for BGP & SNMP Polling

let currentBackupCron: cron.ScheduledTask | null = null;
let currentBackupInterval = '0 * * * *'; // Default 1 Hour

async function runWorker() {
    await forceSyncLibreNMS('Worker');
}

async function reloadBackupSchedule() {
    try {
        const setting = await (prisma as any).appSettings.findFirst({
            where: { key: 'backup_interval_cron' }
        });
        const newInterval = setting?.value || '0 * * * *';
        
        if (newInterval !== currentBackupInterval || !currentBackupCron) {
            console.log(`[Config Worker] Assigning Backup Schedule to: ${newInterval}`);
            currentBackupInterval = newInterval;
            
            if (currentBackupCron) {
                currentBackupCron.stop();
            }
            currentBackupCron = cron.schedule(currentBackupInterval, backupRouterConfigs);
        }
    } catch (e: any) {
        console.error(`[Config Worker] Error syncing backup schedule: ${e.message}`);
    }
}

// Start Base Polling Cron
console.log(`[Poller Worker] Started with schedule: ${CRON_SCHEDULE}`);
cron.schedule(CRON_SCHEDULE, runWorker);

// Initialize Dynamic Backup Cron
reloadBackupSchedule();
cron.schedule('*/5 * * * *', reloadBackupSchedule); // Check for config changes every 5 mins

// Start UDP Syslog Server
startSyslogServer();

// Run BGP Poller immediately on boot
runWorker();
