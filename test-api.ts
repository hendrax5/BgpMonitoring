import { prisma } from './src/lib/prisma';

async function testApi() {
    const servers = await prisma.librenmsServer.findMany();
    if (!servers.length) return console.log('No servers');
    const srv = servers[0];
    
    // test /logs/eventlog
    let url = srv.apiUrl.endsWith('/') ? `${srv.apiUrl}logs/eventlog?limit=5` : `${srv.apiUrl}/logs/eventlog?limit=5`;
    console.log(`Testing ${url}`);
    
    try {
        const res = await fetch(url, { headers: { 'X-Auth-Token': srv.apiToken }});
        console.log('Status:', res.status);
        console.log('Body:', await res.text());
    } catch(e) {
        console.log('Error:', e);
    }
}
testApi();
