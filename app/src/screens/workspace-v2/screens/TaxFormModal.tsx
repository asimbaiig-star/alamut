// TaxFormModal.tsx — W-9 (US) / W-8BEN (international) tax capture (Phase 50)
//
// Two-step modal:
//   1. "Are you a US person?" — drives whether we collect W-9 or W-8BEN
//   2. Form fields, typed signature, submit → v2SaveTaxForm
//
// We never collect a full SSN — only the last 4 digits, or a full EIN.
// Real production needs DocuSign-style signed PDFs + Stripe Identity
// verification of the tax-id. See v2SaveTaxForm() for the prod TODOs.

import { useState } from 'react';
import { pushToast } from '@/lib/utils/toast';
import { v2SaveTaxForm } from '../v2CreatorActions';
import type { TaxFormRecord } from '@/lib/api/types';

interface Props {
  initial?: TaxFormRecord;
  onClose: () => void;
}

export function TaxFormModal({ initial, onClose }: Props) {
  const [kind, setKind] = useState<TaxFormRecord['kind'] | null>(initial?.kind ?? null);
  const [legalName, setLegalName] = useState(initial?.legalName ?? '');
  const [classification, setClassification] = useState<TaxFormRecord['classification']>(
    initial?.classification ?? 'individual',
  );
  const [taxIdLast4, setTaxIdLast4] = useState(initial?.taxIdLast4 ?? '');
  const [country, setCountry] = useState(initial?.country ?? '');
  const [foreignTaxId, setForeignTaxId] = useState(initial?.foreignTaxId ?? '');
  const [address, setAddress] = useState(initial?.address ?? '');
  const [signature, setSignature] = useState(initial?.signature ?? '');
  const [busy, setBusy] = useState(false);

  // Validation: signature must match legalName (typed-attestation)
  const signatureValid = signature.trim().length > 0
    && signature.trim().toLowerCase() === legalName.trim().toLowerCase();
  const taxIdValid = kind === 'W-9'
    ? /^\d{4}$/.test(taxIdLast4.trim()) || /^\d{2}-?\d{7}$/.test(taxIdLast4.trim())
    : true;
  const w8Valid = kind === 'W-8BEN'
    ? country.trim().length >= 2 && foreignTaxId.trim().length > 0
    : true;
  const canSubmit = !!kind
    && legalName.trim().length > 0
    && address.trim().length > 0
    && signatureValid
    && taxIdValid
    && w8Valid
    && !busy;

  function submit() {
    if (!kind || !canSubmit) return;
    setBusy(true);
    const saved = v2SaveTaxForm({
      kind,
      legalName: legalName.trim(),
      classification: kind === 'W-9' ? classification : undefined,
      taxIdLast4: kind === 'W-9' ? taxIdLast4.trim() : undefined,
      country: kind === 'W-8BEN' ? country.trim() : undefined,
      foreignTaxId: kind === 'W-8BEN' ? foreignTaxId.trim() : undefined,
      address: address.trim(),
      signature: signature.trim(),
    });
    setBusy(false);
    if (saved) {
      pushToast(`${kind} on file · thanks`, 'good');
      onClose();
    } else {
      pushToast('Could not save tax form', 'bad');
    }
  }

  return (
    <div className="v2-modal-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="v2-card v2-upload-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 560 }}
      >
        <header className="v2-upload-modal-head">
          <div>
            <h2 style={{
              fontFamily: 'var(--v2-font-display)',
              fontSize: 22, fontWeight: 500, margin: 0, letterSpacing: '-0.02em',
            }}>
              Tax form
            </h2>
            <div className="v2-muted" style={{ fontSize: 12.5, marginTop: 4 }}>
              {kind ? `Filing ${kind}` : 'One question to figure out which form you need'}
            </div>
          </div>
        </header>

        <div className="v2-upload-modal-body">
          {kind === null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ marginTop: 0, fontSize: 13, color: 'var(--v2-ink-2)', lineHeight: 1.55 }}>
                We need the right tax form on file before your first payout clears.
                US persons file <strong>W-9</strong>; everyone else files <strong>W-8BEN</strong>.
              </p>
              <button
                type="button"
                className="v2-btn v2-btn-outline"
                onClick={() => setKind('W-9')}
                style={{ justifyContent: 'flex-start', padding: '14px 16px', textAlign: 'left' }}
              >
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>I&apos;m a US person</div>
                  <div className="v2-muted" style={{ fontSize: 11.5 }}>Citizen, green-card holder, or US tax resident. Files W-9.</div>
                </div>
              </button>
              <button
                type="button"
                className="v2-btn v2-btn-outline"
                onClick={() => setKind('W-8BEN')}
                style={{ justifyContent: 'flex-start', padding: '14px 16px', textAlign: 'left' }}
              >
                <div>
                  <div style={{ fontWeight: 600, marginBottom: 2 }}>I&apos;m a non-US person</div>
                  <div className="v2-muted" style={{ fontSize: 11.5 }}>Foreign individual or sole-proprietor. Files W-8BEN.</div>
                </div>
              </button>
            </div>
          )}

          {kind !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>Legal name (as on ID)</label>
                <input
                  className="v2-input"
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder={kind === 'W-9' ? 'e.g. Sarah Johnson' : 'Full legal name'}
                  autoFocus
                />
              </div>

              {kind === 'W-9' && (
                <>
                  <div>
                    <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>
                      Tax classification
                    </label>
                    <select
                      className="v2-input"
                      value={classification}
                      onChange={(e) => setClassification(e.target.value as TaxFormRecord['classification'])}
                    >
                      <option value="individual">Individual</option>
                      <option value="sole-proprietor">Sole proprietor</option>
                      <option value="llc">LLC</option>
                      <option value="corporation">Corporation</option>
                    </select>
                  </div>
                  <div>
                    <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>
                      Tax ID — last 4 of SSN, or full EIN
                    </label>
                    <input
                      className="v2-input"
                      value={taxIdLast4}
                      onChange={(e) => setTaxIdLast4(e.target.value)}
                      placeholder="1234 (SSN last 4) or 12-3456789 (EIN)"
                      maxLength={10}
                    />
                    <div className="v2-muted" style={{ fontSize: 11, marginTop: 6 }}>
                      We never store a full SSN. For EIN, enter the full 9-digit number.
                    </div>
                  </div>
                </>
              )}

              {kind === 'W-8BEN' && (
                <>
                  <div>
                    <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>
                      Country of tax residence
                    </label>
                    <input
                      className="v2-input"
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="e.g. Pakistan, United Kingdom, Brazil"
                    />
                  </div>
                  <div>
                    <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>
                      Foreign tax ID number
                    </label>
                    <input
                      className="v2-input"
                      value={foreignTaxId}
                      onChange={(e) => setForeignTaxId(e.target.value)}
                      placeholder="National tax identification number"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>
                  Permanent residence address
                </label>
                <textarea
                  className="v2-input"
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Street, city, state/region, postal code, country"
                />
              </div>

              <div style={{ marginTop: 4, paddingTop: 12, borderTop: '1px solid var(--v2-line)' }}>
                <label className="v2-eyebrow" style={{ display: 'block', marginBottom: 6 }}>
                  Signature
                </label>
                <input
                  className="v2-input"
                  value={signature}
                  onChange={(e) => setSignature(e.target.value)}
                  placeholder="Type your legal name exactly as above"
                />
                <div className="v2-muted" style={{ fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>
                  By typing your name and submitting, you certify that the information above is true to
                  the best of your knowledge, equivalent to signing the {kind} form. We store a timestamp
                  with each submission.
                </div>
                {signature.length > 0 && !signatureValid && (
                  <div style={{ fontSize: 11, color: 'var(--v2-accent)', marginTop: 4 }}>
                    Signature must match legal name above.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="v2-upload-modal-foot">
          <div className="v2-row" style={{ gap: 8 }}>
            <button
              className="v2-btn v2-btn-outline"
              type="button"
              style={{ flex: 1 }}
              onClick={() => (kind !== null && !initial ? setKind(null) : onClose())}
            >
              {kind !== null && !initial ? 'Back' : 'Cancel'}
            </button>
            {kind !== null && (
              <button
                className="v2-btn v2-btn-primary"
                type="button"
                style={{ flex: 2 }}
                disabled={!canSubmit}
                onClick={submit}
              >
                {busy ? 'Saving…' : `Submit ${kind}`}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
