'use client';

import { removeSession } from '@/app/actions/settings';

export default function DeleteSessionButton({ serverName, deviceId, peerIp }: {
    serverName: string; deviceId: string; peerIp: string;
}) {
    return (
        <form action={removeSession}>
            <input type="hidden" name="serverName" value={serverName} />
            <input type="hidden" name="deviceId" value={deviceId} />
            <input type="hidden" name="peerIp" value={peerIp} />
            <button
                type="submit"
                className="btn-danger"
                title="Remove this peer from the dashboard (does not affect router configuration)"
                aria-label={`Remove peer ${peerIp} from dashboard`}
                onClick={(e) => {
                    if (!confirm(`Remove peer ${peerIp} from the dashboard?\n\nThis only affects the monitoring view — it does not change any router configuration.`)) {
                        e.preventDefault();
                    }
                }}
            >
                <span className="material-symbols-outlined text-sm" aria-hidden="true">delete</span>
                Remove
            </button>
        </form>
    );
}
