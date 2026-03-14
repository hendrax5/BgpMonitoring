declare module 'net-snmp' {
    export const Version1: number;
    export const Version2c: number;
    export const Version3: number;

    export interface SessionOptions {
        port?: number;
        retries?: number;
        timeout?: number;
        timeouts?: number[];
        transport?: 'udp4' | 'udp6';
        version?: number;
        backoff?: number;
        idBitsSize?: number;
    }

    export function createSession(target: string, community: string, options?: SessionOptions): any;
    export function createV3Session(target: string, user: any, options?: SessionOptions): any;
    export function isVarbindError(varbind: any): boolean;
}
