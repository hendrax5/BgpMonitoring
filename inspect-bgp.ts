import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const server = await prisma.librenmsServer.findFirst();
    if (!server) {
        console.log("No LibreNMS server configured.");
        return;
    }
    
    console.log(`Fetching from ${server.apiUrl}/bgp ...`);
    try {
        const url = server.apiUrl.endsWith('/') ? `${server.apiUrl}bgp` : `${server.apiUrl}/bgp`;
        const res = await fetch(url, {
            headers: { 'X-Auth-Token': server.apiToken }
        });
        const data = await res.json();
        console.log("Found sessions:", data.bgp_sessions?.length);
        if (data.bgp_sessions?.length > 0) {
            console.log("Sample session 1:");
            console.log(JSON.stringify(data.bgp_sessions[0], null, 2));
            console.log("Sample session 2:");
            console.log(JSON.stringify(data.bgp_sessions[1], null, 2));
        }
    } catch (e) {
        console.error("Error fetching", e);
    }
}

main().finally(() => prisma.$disconnect());
