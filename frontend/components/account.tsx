'use client';
import { useState } from 'react';
import { api, result } from '@/lib/api';
import { supabase } from '@/lib/auth';
import { go, message } from './ui';
export default function AccountControls({ done }: { done: () => void }) {
  const [status, setStatus] = useState(''),
    [confirmation, setConfirmation] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <section className="stack account-controls">
      <h2>Account controls</h2>
      <label>
        Profile photo
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setBusy(true);
            try {
              result(
                await api.POST('/v1/avatar', {
                  body: '',
                  bodySerializer: () => file,
                  headers: { 'Content-Type': 'application/octet-stream' },
                })
              );
              setStatus('Photo saved');
              done();
            } catch (e) {
              setStatus(message(e));
            } finally {
              setBusy(false);
            }
          }}
        />
      </label>
      <small>
        PNG or JPEG, up to 512 × 512 pixels and 256 KB. Photos are validated by
        the Go API.
      </small>
      <details>
        <summary>Delete my account</summary>
        <p>
          Deletes your profile, diary, memories, reviews, lists, and
          authentication account. This cannot be undone.
        </p>
        <label>
          Type DELETE to confirm
          <input
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
          />
        </label>
        <button
          disabled={confirmation !== 'DELETE' || busy}
          onClick={async () => {
            setBusy(true);
            try {
              result(
                await api.POST('/v1/account-delete', { body: { confirmation } })
              );
              await supabase.auth.signOut();
              go('discover');
            } catch (e) {
              setStatus(message(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Permanently delete account
        </button>
      </details>
      <p role="status">{status}</p>
    </section>
  );
}
