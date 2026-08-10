// In-pod "lab router" SSH server — stands in for a real router so the
// Push-to-Router SSH flow can be exercised end-to-end in the preview env.
// Accepts password auth (labadmin/labpass), echoes an ack in shell mode,
// and returns a canned partial BGP config for "show/display" exec commands
// (so Config Diff shows realistic added/removed lines).
const { Server } = require('ssh2');
const crypto = require('crypto');

const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
});

const PORT = 2222;
const USER = 'labadmin';
const PASS = 'labpass';

// Canned "running config" the fake router reports (intentionally missing the
// description / maximum-prefix / route-maps so a diff has something to show).
const CANNED_CONFIG = [
    'router bgp 65000',
    ' neighbor 203.0.113.10 remote-as 64512',
    ' address-family ipv4 unicast',
    '  neighbor 203.0.113.10 activate',
    ' exit-address-family',
].join('\n');

function isShowCmd(cmd) {
    return /show|display|current-configuration|\/routing|print|configuration/i.test(cmd);
}

new Server({ hostKeys: [privateKey] }, (client) => {
    client.on('authentication', (ctx) => {
        if (ctx.method === 'password' && ctx.username === USER && ctx.password === PASS) return ctx.accept();
        if (ctx.method === 'none') return ctx.reject(['password']);
        return ctx.accept(); // lenient for lab use
    });

    client.on('ready', () => {
        client.on('session', (accept) => {
            const session = accept();
            session.on('pty', (a) => a && a());

            session.on('exec', (accept, reject, info) => {
                const stream = accept();
                const cmd = info.command || '';
                if (isShowCmd(cmd)) stream.write(CANNED_CONFIG + '\n');
                else stream.write(`Executed: ${cmd}\r\n% OK\r\n`);
                stream.exit(0);
                stream.end();
            });

            session.on('shell', (accept) => {
                const stream = accept();
                stream.write('LAB-ROUTER (fake) ready\r\nLAB-ROUTER> ');
                let buf = '';
                stream.on('data', (d) => {
                    buf += d.toString();
                    let idx;
                    while ((idx = buf.indexOf('\n')) >= 0) {
                        const line = buf.slice(0, idx).trim();
                        buf = buf.slice(idx + 1);
                        if (!line) { stream.write('LAB-ROUTER> '); continue; }
                        if (line === 'exit' || line === 'quit') { stream.write('bye\r\n'); stream.exit(0); stream.end(); return; }
                        stream.write(`${line}\r\n% OK\r\nLAB-ROUTER> `);
                    }
                });
            });
        });
    });

    client.on('error', () => {});
}).listen(PORT, '127.0.0.1', () => {
    console.log(`[lab-router] Fake router SSH listening on 127.0.0.1:${PORT} (user ${USER})`);
});
