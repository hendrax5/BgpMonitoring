import { backupRouterConfigs } from './src/worker/config-backup';

console.log('--- FORCING BACKUP ROUTER CONFIGS ---');
backupRouterConfigs().then(() => {
    console.log('--- FINISHED ---');
    process.exit(0);
}).catch(e => {
    console.error('--- ERROR ---', e);
    process.exit(1);
});
