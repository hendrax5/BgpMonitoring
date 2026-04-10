import SubmitButton from '@/app/components/SubmitButton';
import { addAlertChannel, updateAlertChannel, deleteAlertChannel } from '@/app/actions/settings';

export default function AlertChannelsManager({ alertChannels, editAlertObj }: { alertChannels: any[], editAlertObj: any }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
                <h4 className="font-bold text-white mb-2">{editAlertObj ? 'Edit Alert Channel' : 'Add Alert Channel'}</h4>
                <p className="text-xs mb-4 text-zinc-400">Receive BGP notifications via Omnichannel webhooks or bots.</p>
                
                <form action={async (formData: FormData) => {
                    'use server';
                    const id = formData.get('id');
                    if (id) await updateAlertChannel(formData);
                    else await addAlertChannel(formData);
                }} className="space-y-3">
                    {editAlertObj && <input type="hidden" name="id" value={editAlertObj.id} />}
                    
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Channel Name</label>
                        <input type="text" name="name" placeholder="e.g. NOC Telegram"
                            defaultValue={editAlertObj?.name || ''} required
                            className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Provider</label>
                            <select name="provider" defaultValue={editAlertObj?.provider || 'telegram'} className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white">
                                <option value="telegram">Telegram</option>
                                <option value="discord">Discord</option>
                                <option value="slack">Slack</option>
                                <option value="webhook">Custom Webhook</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Event Types (CSV)</label>
                            <input type="text" name="eventTypes" placeholder="UP,DOWN"
                                defaultValue={editAlertObj?.eventTypes || 'UP,DOWN,COMPLIANCE_FAILED'} required
                                className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">Webhook URL (For Discord/Slack/Custom)</label>
                        <input type="text" name="webhookUrl" placeholder="https://..."
                            defaultValue={editAlertObj?.webhookUrl || ''}
                            className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Telegram Bot Token</label>
                            <input type="password" name="botToken" placeholder="123:ABC..."
                                defaultValue={editAlertObj?.botToken || ''}
                                className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-zinc-400 mb-1">Telegram Chat ID</label>
                            <input type="text" name="chatId" placeholder="-100..."
                                defaultValue={editAlertObj?.chatId || ''}
                                className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-3 py-2 text-xs text-white" />
                        </div>
                    </div>

                    {editAlertObj && (
                        <div>
                            <label className="flex items-center gap-2 text-xs font-medium text-zinc-300">
                                <input type="checkbox" name="isActive" defaultChecked={editAlertObj.isActive} className="rounded" />
                                Active
                            </label>
                        </div>
                    )}

                    <div className="flex gap-2">
                        <SubmitButton className="flex-1 py-2 text-sm font-bold rounded-xl text-white bg-blue-600">
                            {editAlertObj ? 'Update' : 'Save'}
                        </SubmitButton>
                        {editAlertObj && (
                            <a href="/settings?tab=system" className="flex-1 py-2 text-center text-sm font-bold rounded-xl bg-white/5 text-zinc-400">Cancel</a>
                        )}
                    </div>
                </form>
            </div>

            <div className="md:col-span-2">
                 <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/20 text-sm">
                    <table className="w-full text-left whitespace-nowrap">
                        <thead className="text-xs uppercase text-zinc-400 bg-white/5">
                            <tr>
                                <th className="px-4 py-3">Channel Name</th>
                                <th className="px-4 py-3">Provider</th>
                                <th className="px-4 py-3">Events</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {alertChannels.map(c => (
                                <tr key={c.id} className="hover:bg-white/5">
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-white flex items-center gap-2">
                                            <span className={`w-2 h-2 rounded-full ${c.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                            {c.name}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-[10px] font-bold px-2 py-0.5 border rounded-lg uppercase">{c.provider}</span>
                                    </td>
                                    <td className="px-4 py-3 text-xs text-zinc-400">{c.eventTypes}</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex items-center justify-end gap-1">
                                            <a href={`/settings?tab=system&editAlert=${c.id}`} className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400">
                                                <span className="material-symbols-outlined text-[1rem]">edit</span>
                                            </a>
                                            <form action={async () => { 'use server'; await deleteAlertChannel(c.id); }}>
                                                <button className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400">
                                                    <span className="material-symbols-outlined text-[1rem]">delete</span>
                                                </button>
                                            </form>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {alertChannels.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="text-center p-6 text-zinc-500">No alert channels configured.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                 </div>
            </div>
        </div>
    );
}
