import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
    console.log("Starting API Test...");
    const servers = await prisma.librenmsServer.findMany();
    if (servers.length === 0) { console.log("No servers."); return; }
    const srv = servers[0];
    
    const url = srv.apiUrl.endsWith('/') ? `${srv.apiUrl}bgp` : `${srv.apiUrl}/bgp`;
    console.log("Fetching: " + url);
    const res = await fetch(url, { headers: { 'X-Auth-Token': srv.apiToken }});
    const data = await res.json();
    console.log("BGP Top keys:", Object.keys(data));
    if (data.bgp_sessions && Array.isArray(data.bgp_sessions)) {
        console.log("Total received sessions:", data.bgp_sessions.length);
        const deviceIds = new Set();
        for (const b of data.bgp_sessions) deviceIds.add(b.device_id);
        console.log("Unique device IDs in bgp payload:", Array.from(deviceIds));
    }

    const devUrl = srv.apiUrl.endsWith('/') ? `${srv.apiUrl}devices` : `${srv.apiUrl}/devices`;
    console.log("Fetching: " + devUrl);
    const devRes = await fetch(devUrl, { headers: { 'X-Auth-Token': srv.apiToken }});
    const devData = await devRes.json();
    if (devData.devices && Array.isArray(devData.devices)) {
        console.log("Total received devices:", devData.devices.length);
    }
}

run().catch(console.error).finally(() => process.exit(0));
