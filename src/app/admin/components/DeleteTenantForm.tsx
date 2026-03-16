'use client';

interface DeleteTenantFormProps {
    tenantId: string;
    tenantName: string;
    deleteTenant: (formData: FormData) => Promise<void>;
}

export function DeleteTenantForm({ tenantId, tenantName, deleteTenant }: DeleteTenantFormProps) {
    return (
        <form
            action={deleteTenant}
            onSubmit={(e) => {
                if (!confirm(`Hapus tenant "${tenantName}"? Semua data akan terhapus permanen.`)) {
                    e.preventDefault();
                }
            }}
        >
            <input type="hidden" name="tenantId" value={tenantId} />
            <button
                type="submit"
                className="text-xs px-2.5 py-1 rounded-lg"
                style={{ color: '#f43f5e', border: '1px solid rgba(244,63,94,0.3)' }}
            >
                Hapus
            </button>
        </form>
    );
}
