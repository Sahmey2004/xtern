'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { updateDisplayName, updatePassword } from '@/lib/auth';

export default function AccountPage() {
  const { user, role, displayName } = useAuth();
  const [newName, setNewName] = useState(displayName);
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [nameSaving, setNameSaving] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setNameSaving(true);
    setNameMsg(null);
    try {
      await updateDisplayName(newName.trim());
      setNameMsg({ ok: true, text: 'Display name updated.' });
    } catch (err: unknown) {
      setNameMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed to update name.' });
    } finally {
      setNameSaving(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setPwMsg({ ok: false, text: 'Passwords do not match.' });
      return;
    }
    if (password.length < 6) {
      setPwMsg({ ok: false, text: 'Password must be at least 6 characters.' });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      await updatePassword(password);
      setPwMsg({ ok: true, text: 'Password updated successfully.' });
      setPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed to update password.' });
    } finally {
      setPwSaving(false);
    }
  };

  const roleLabel = role === 'administrator' ? 'Administrator' : 'PO Manager';
  const roleBadge = role === 'administrator' ? 'badge-purple' : 'badge-blue';

  return (
    <div style={{ maxWidth: 560 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
          Account Settings
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>
          Manage your display name, password, and view your role.
        </p>
      </div>

      {/* Profile info */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Profile
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--accent-blue-glow)',
            border: '2px solid var(--accent-blue)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 700, color: 'var(--accent-blue)',
            flexShrink: 0,
          }}>
            {displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{displayName}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{user?.email}</div>
          </div>
          <span className={`badge ${roleBadge}`} style={{ marginLeft: 'auto' }}>
            {roleLabel}
          </span>
        </div>

        <form onSubmit={handleSaveName} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Display Name
            </label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              placeholder="Your full name"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          {nameMsg && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, fontSize: 13,
              background: nameMsg.ok ? 'var(--accent-green-glow)' : 'var(--accent-red-glow)',
              color: nameMsg.ok ? 'var(--accent-green)' : 'var(--accent-red)',
              border: `1px solid ${nameMsg.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              {nameMsg.text}
            </div>
          )}
          <div>
            <button type="submit" className="btn-primary" disabled={nameSaving} style={{ fontSize: 13, padding: '8px 18px' }}>
              {nameSaving ? 'Saving…' : 'Save Name'}
            </button>
          </div>
        </form>
      </div>

      {/* Password change */}
      <div className="card" style={{ padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Change Password
        </h2>
        <form onSubmit={handleSavePassword} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Min. 6 characters"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          {pwMsg && (
            <div style={{
              padding: '8px 12px', borderRadius: 6, fontSize: 13,
              background: pwMsg.ok ? 'var(--accent-green-glow)' : 'var(--accent-red-glow)',
              color: pwMsg.ok ? 'var(--accent-green)' : 'var(--accent-red)',
              border: `1px solid ${pwMsg.ok ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            }}>
              {pwMsg.text}
            </div>
          )}
          <div>
            <button type="submit" className="btn-primary" disabled={pwSaving} style={{ fontSize: 13, padding: '8px 18px' }}>
              {pwSaving ? 'Updating…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>

      {/* Role info */}
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Role & Access
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{roleLabel}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
              {role === 'administrator'
                ? 'Full access: Pipeline, Approval Queue, Decision Log, Suppliers, Data.'
                : 'Limited access: Pipeline and Data only.'}
            </div>
          </div>
          <span className={`badge ${roleBadge}`}>{roleLabel}</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
          Role changes must be made by an administrator via the Supabase Dashboard.
        </p>
      </div>
    </div>
  );
}
