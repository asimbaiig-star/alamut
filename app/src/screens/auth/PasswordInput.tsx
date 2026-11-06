// PasswordInput.tsx — a password field you can read back before you submit.
// Typing a password you can't see is where sign-ups fail on a phone.

import { useState, type InputHTMLAttributes } from 'react';

export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [shown, setShown] = useState(false);
  return (
    <span className="auth-v2-pw">
      <input {...props} type={shown ? 'text' : 'password'} />
      <button type="button" aria-pressed={shown} aria-label="Show password" onClick={() => setShown((s) => !s)}>
        {shown ? 'Hide' : 'Show'}
      </button>
    </span>
  );
}
