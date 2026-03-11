import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalEvents } from '@/app/actions/reports';
import Papa from 'papaparse';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const start = searchParams.get('start') || undefined;
    const end = searchParams.get('end') || undefined;
    const asn = searchParams.get('asn') || undefined;

    const events = await getHistoricalEvents({ startDate: start, endDate: end, asn });

    // Map to clear CSV columns
    const csvData = events.map(ev => {
        let downtime = '';
        if (ev.downtimeDuration !== null) {
            downtime = `${Math.floor(ev.downtimeDuration / 60)}m ${ev.downtimeDuration % 60}s`;
        }

        return {
            'Timestamp': ev.eventTimestamp.toISOString(),
            'Server Source': ev.serverName,
            'Device Name': ev.deviceName,
            'Device IP': ev.deviceIp,
            'Peer IP': ev.peerIp,
            'ASN': ev.asn.toString(),
            'Organization': ev.organizationName,
            'Event Type': ev.eventType,
            'Downtime Duration': downtime,
            'Downtime (Seconds)': ev.downtimeDuration || 0
        };
    });

    const csvString = Papa.unparse(csvData);

    // Return as downloadable file
    return new NextResponse(csvString, {
        headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="bgp_report_${new Date().toISOString().split('T')[0]}.csv"`
        }
    });
}
