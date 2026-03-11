import { NextRequest, NextResponse } from 'next/server';
import { getHistoricalEvents, getTopFlappingPeers } from '@/app/actions/reports';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const start = searchParams.get('start') || undefined;
    const end = searchParams.get('end') || undefined;
    const asn = searchParams.get('asn') || undefined;

    const events = await getHistoricalEvents({ startDate: start, endDate: end, asn });
    const flapStats = await getTopFlappingPeers(start, end);

    // Initialize PDF
    const doc = new jsPDF();
    const pageHeight = doc.internal.pageSize.height;

    // Custom Header
    doc.setFillColor(11, 15, 25); // Dark blue background color
    doc.rect(0, 0, doc.internal.pageSize.width, 30, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('BGP Watcher SLA Report', 14, 20);

    doc.setTextColor(59, 130, 246); // Primary blue
    doc.setFontSize(10);
    doc.text('LibreNMS Reporting Engine', 140, 20);

    // Metadata Section
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    let yPos = 40;
    doc.text(`Generated: ${format(new Date(), 'PPp')}`, 14, yPos);
    yPos += 7;
    doc.text(`Time Range: ${start ? format(new Date(start), 'PP') : 'Beginning'} - ${end ? format(new Date(end), 'PP') : 'Now'}`, 14, yPos);
    yPos += 7;
    if (asn) {
        doc.text(`Filtered by ASN: ${asn}`, 14, yPos);
        yPos += 7;
    }

    doc.text(`Total Events Logged: ${events.length}`, 14, yPos);
    yPos += 15;

    // --- TOP FLAPPING PEERS TABLE ---
    if (flapStats.length > 0 && !asn) {
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.text('Top Flapping Peers (Most Drops)', 14, yPos);
        yPos += 5;

        const flapBody = flapStats.map(f => [
            f.peerIp,
            `AS${f.asn.toString()}`,
            f.organizationName,
            `${f._count.eventId} Drops`
        ]);

        autoTable(doc, {
            startY: yPos,
            head: [['Peer IP', 'ASN', 'Organization', 'Drop Count']],
            body: flapBody,
            headStyles: { fillColor: [239, 68, 68] }, // Red header for flapping
            margin: { left: 14, right: 14 }
        });

        yPos = (doc as any).lastAutoTable.finalY + 15;
    }

    // --- DETAILED HISTORICAL EVENTS TABLE ---
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);

    if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = 20;
    }

    doc.text('Historical Downtime Events', 14, yPos);
    yPos += 5;

    const tableBody = events.map(ev => {
        let downtime = '-';
        if (ev.downtimeDuration !== null) {
            downtime = `${Math.floor(ev.downtimeDuration / 60)}m ${ev.downtimeDuration % 60}s`;
        }
        return [
            format(ev.eventTimestamp, 'MM/dd HH:mm'),
            ev.serverName,
            ev.peerIp,
            `${ev.organizationName} (AS${ev.asn})`,
            ev.eventType,
            downtime
        ];
    });

    autoTable(doc, {
        startY: yPos,
        head: [['Time', 'Server', 'Peer IP', 'Organization', 'Status', 'Downtime']],
        body: tableBody,
        headStyles: { fillColor: [59, 130, 246] }, // Primary blue header
        alternateRowStyles: { fillColor: [245, 247, 250] },
        columnStyles: {
            4: { textColor: [255, 255, 255], fontStyle: 'bold' } // Style status column
        },
        didDrawCell: function (data) {
            // Color code DOWN and UP
            if (data.section === 'body' && data.column.index === 4) {
                if (data.cell.raw === 'DOWN') {
                    doc.setFillColor(239, 68, 68);
                    doc.rect(data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.text(data.cell.raw as string, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: 'center' });
                } else if (data.cell.raw === 'UP') {
                    doc.setFillColor(16, 185, 129);
                    doc.rect(data.cell.x + 2, data.cell.y + 2, data.cell.width - 4, data.cell.height - 4, 'F');
                    doc.setTextColor(255, 255, 255);
                    doc.text(data.cell.raw as string, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: 'center' });
                }
            }
        }
    });

    // Output PDF as Buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
        headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="bgp_report_${format(new Date(), 'yyyyMMdd')}.pdf"`
        }
    });
}
