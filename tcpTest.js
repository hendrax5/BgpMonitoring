const net = require('net');

async function testRuijie() {
    const socket = new net.Socket();
    let sequence = 0;
    
    socket.connect(23, '103.162.16.105', () => {
        console.log('Connected');
    });

    socket.on('data', (data) => {
        const text = data.toString('utf8');
        console.log('<< RECV:', JSON.stringify(text));
        
        if (sequence === 0 && text.toLowerCase().includes('name:')) {
            sequence++;
            console.log('>> SEND: hendra');
            socket.write('hendra\r\n');
        } else if (sequence === 1 && text.toLowerCase().includes('ssword:')) {
            sequence++;
            console.log('>> SEND: ***');
            socket.write('!Tahun2026\r\n');
        } else if (sequence === 2 && (text.includes('>') || text.includes('#'))) {
            sequence++;
            console.log('>> SEND: terminal length 0');
            socket.write('terminal length 0\r\n');
        } else if (sequence === 3 && (text.includes('>') || text.includes('#'))) {
            sequence++;
            console.log('>> SEND: show running-config');
            socket.write('show running-config\r\n');
        } else if (sequence === 4) {
            if (text.toLowerCase().includes('more')) {
                console.log('>> PAGINATION DETECTED, SENDING SPACE');
                socket.write(' ');
            }
            if (text.includes('Building')) {
                console.log('Build received.');
            }
        }
    });

    socket.on('error', (err) => console.error('Error:', err));
    socket.on('close', () => console.log('Closed'));
    
    setTimeout(() => {
        console.log('Timeout. Destorying.');
        socket.destroy();
    }, 15000);
}

testRuijie();
