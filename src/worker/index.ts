import cron from 'node-cron';
import { forceSyncLibreNMS } from './sync';

// Configuration
const CRON_SCHEDULE = '*/1 * * * *'; // Every minute for development (change to */5 for production)

async function runWorker() {
    await forceSyncLibreNMS('Worker');
}

// Start Cron
console.log(`BGP Worker started with schedule: ${CRON_SCHEDULE}`);
cron.schedule(CRON_SCHEDULE, runWorker);

// Run immediately on boot
runWorker();
