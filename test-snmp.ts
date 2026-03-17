import { SnmpPoller } from './src/lib/pollers/snmp';

async function test() {
    console.log('Testing BGP4-MIB on Huawei CORE-INDOTEL (160.19.19.254)');
    const poller = new SnmpPoller('160.19.19.254', 'snmpindotel+_)-', 'v2c', 161);
    
    try {
        const peers = await poller.getBgpPeersFromMib();
        console.log(`Found ${peers.size} standard BGP4-MIB peers!`);
    } catch (e) {
        console.error('Error standard:', e);
    }
    
    console.log('Testing hwBgpMib (Huawei specific) on CORE-INDOTEL');
    try {
        // hwBgpPeerState = 1.3.6.1.4.1.2011.5.25.177.1.1.2.1.5
        const map = await poller.walkTable('1.3.6.1.4.1.2011.5.25.177.1.1.2.1.5');
        console.log(`Found ${map.size} hwBgp peers!`);
    } catch (e) {
        console.error('Error huawei:', e);
    }

    poller.close();
}

test();
