import snmp from 'net-snmp';

export class SnmpPoller {
    private session: any;

    constructor(
        private ip: string,
        private community: string = 'public',
        private version: string = 'v2c',
        private port: number = 161
    ) {
        const snmpVersion = version === 'v3' ? snmp.Version3 : snmp.Version2c;
        // Basic v2c session, v3 requires more params but this is a starting point
        this.session = snmp.createSession(this.ip, this.community, {
            port: this.port,
            version: snmpVersion,
            timeouts: [1000, 2000],
            retries: 2,
        });
    }

    /**
     * Walks an OID tree and returns an array of { oid, value, type }
     */
    async walk(oid: string): Promise<Array<{ oid: string; value: string | number | Buffer; type: number }>> {
        return new Promise((resolve, reject) => {
            const results: Array<{ oid: string; value: string | number | Buffer; type: number }> = [];
            
            const feedCb = (varbinds: any[]) => {
                for (let i = 0; i < varbinds.length; i++) {
                    if (snmp.isVarbindError(varbinds[i])) {
                        // ignore or log
                    } else {
                        results.push({
                            oid: varbinds[i].oid.toString(),
                            value: varbinds[i].value,
                            type: varbinds[i].type
                        });
                    }
                }
            };

            this.session.walk(oid, 20, feedCb, (error: any) => {
                if (error) {
                    // if it's just end of MIB view, it's fine. 
                    if (error.message && error.message.includes('Timeout')) {
                        return reject(error);
                    }
                }
                resolve(results);
            });
        });
    }

    /**
     * Closes the SNMP session
     */
    close() {
        if (this.session) {
            this.session.close();
        }
    }
}
