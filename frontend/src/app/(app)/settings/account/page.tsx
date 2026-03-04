'use client';

import { useEffect, useState } from 'react';

import { useAuth } from '@/components/auth-provider';
import { updateAccountSettings } from '@/lib/api';

export default function AccountSettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    setFullName(profile?.full_name || '');
  }, [profile?.full_name]);

  const onSave = async () => {
    if (!fullName.trim()) return;
    setSaving(true);
    setToast('');
    try {
      await updateAccountSettings(fullName.trim());
      await refreshProfile();
      setToast('Account settings updated.');
    } catch (error: unknown) {
      setToast(error instanceof Error ? error.message : 'Failed to update account settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-shell">
      <section className="surface-card p-8 max-w-2xl">
        <p className="eyebrow">Account Settings</p>
        <h1 className="page-title">Profile details</h1>
        <p className="page-subtitle">Manage your display name and review role metadata.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="field-label">Email</label>
            <input className="field-input" value={profile?.email || ''} readOnly />
          </div>
          <div>
            <label className="field-label">Role</label>
            <input className="field-input" value={profile?.role || ''} readOnly />
          </div>
          <div>
            <label className="field-label">Full Name</label>
            <input className="field-input" value={fullName} onChange={event => setFullName(event.target.value)} />
          </div>
        </div>

        {toast && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            {toast}
          </div>
        )}

        <button className="button button-primary mt-5" onClick={onSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </section>
    </div>
  );
}

