import { updateMyProfile } from '@/app/actions/users';
import SubmitButton from '@/app/components/SubmitButton';

export default async function ProfileTab({ session }: { session: any }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card p-6 border border-white/5 bg-white/5 backdrop-blur-xl rounded-2xl shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex flex-shrink-0 items-center justify-center text-2xl font-bold text-white uppercase shadow-lg">
                        {session.username?.charAt(0) || 'U'}
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">{session.username}</h3>
                        <span className="px-2 py-0.5 mt-1 inline-block text-[10px] font-bold rounded-lg border bg-blue-500/10 border-blue-500/20 text-blue-400 uppercase tracking-wider">
                            {session.role}
                        </span>
                    </div>
                </div>
                <hr className="border-white/5 my-6" />
                <h4 className="font-bold text-white mb-4">Change Password</h4>
                <form action={async (formData: FormData) => {
                    'use server';
                    await updateMyProfile(formData);
                }} className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-zinc-400 mb-1">New Password</label>
                        <input type="password" name="newPassword" placeholder="Enter a new password" required
                            className="w-full bg-[#0a1019] border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500" />
                    </div>
                    <SubmitButton className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl transition-colors shadow-lg shadow-blue-900/20">
                        Update Password
                    </SubmitButton>
                </form>
            </div>
        </div>
    );
}
