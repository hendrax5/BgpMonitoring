const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const server = await prisma.librenmsServer.findFirst();
    if (!server) {
        console.log("No config");
        return;
    }
    const url = server.api_url ? server.api_url : server.apiUrl;
    const token = server.api_token ? server.api_token : server.apiToken;
    console.log("URL:", url);
    const fetch = require('node-fetch'); // or global fetch in Node 18+
    try {
        const fetchUrl = url.endsWith('/') ? `${url}bgp` : `${url}/bgp`;
        const res = await global.fetch(fetchUrl, { headers: { 'X-Auth-Token': token } });
        const data = await res.json();
        const s = data.bgp_sessions && data.bgp_sessions[0];
        console.log(JSON.stringify(s, null, 2));
    } catch(e) { console.log(e); }
}
main().finally(() => prisma.$disconnect());
