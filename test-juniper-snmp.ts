import { SnmpPoller } from './src/lib/pollers/snmp';

async function testJuniper() {
    console.log('Testing jnxBgpM2MIB alternative OIDs on MX1K4 (103.139.162.102)');
    const poller = new SnmpPoller('103.139.162.102', 'snmpd----------', 'v2c', 161);
    
    // jnxBgpM2PeerState           1.3.6.1.4.1.2636.5.1.1.2.1.1.1.2
    // jnxBgpM2PeerRemoteAs        1.3.6.1.4.1.2636.5.1.1.2.1.1.1.11
    // jnxBgpM2PeerRemoteAs (alt)  1.3.6.1.4.1.2636.5.1.1.2.1.1.1.13  (User Screenshot)

    try {
        console.log('Walking .2 (Peer State)...');
        const stateMap = await poller.walkTable('1.3.6.1.4.1.2636.5.1.1.2.1.1.1.2');
        console.log(`Found ${stateMap.size} peers from state OID`);
        
        console.log('Walking .11 (Remote AS)...');
        const asMap = await poller.walkTable('1.3.6.1.4.1.2636.5.1.1.2.1.1.1.11');
        console.log(`Found ${asMap.size} peers from AS OID`);

        console.log('Walking .13 (Remote AS / State Alt)...');
        const altMap = await poller.walkTable('1.3.6.1.4.1.2636.5.1.1.2.1.1.1.13'); // user image check
        console.log(`Found ${altMap.size} peers from Alt OID`);

    } catch (e) {
        console.error('Error walking juniper MIB:', e);
    }

    poller.close();
}

testJuniper();
