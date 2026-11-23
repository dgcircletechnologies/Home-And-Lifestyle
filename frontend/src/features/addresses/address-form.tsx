'use client';
import { useState } from 'react';
import { ApiError } from '../../lib/api';
import { StoreCTA } from '../store/store-cta';
import type { Address, AddressInput } from './addresses-api';

const blank: AddressInput = { fullName: '', phone: '', line1: '', line2: '', city: '', state: '', pinCode: '', label: 'Home', isDefault: false };
type Field = keyof AddressInput;
const validate = (value: AddressInput) => {
  const errors: Partial<Record<Field, string>> = {};
  for (const field of ['fullName', 'line1', 'city', 'state'] as const) if (!value[field].trim()) errors[field] = 'This field is required.';
  if (!/^[6-9][0-9]{9}$/.test(value.phone)) errors.phone = 'Enter a valid 10-digit Indian mobile number.';
  if (!/^[1-9][0-9]{5}$/.test(value.pinCode)) errors.pinCode = 'Enter a valid 6-digit Indian PIN code.';
  return errors;
};

export function AddressForm({ initial, onSave, onCancel, title = 'Add a new address' }: { initial?: Address; onSave: (input: AddressInput) => Promise<void>; onCancel: () => void; title?: string }) {
  const [value, setValue] = useState<AddressInput>(initial ? { fullName: initial.fullName, phone: initial.phone, line1: initial.line1, line2: initial.line2 ?? '', city: initial.city, state: initial.state, pinCode: initial.pinCode, label: initial.label ?? 'Other', isDefault: initial.isDefault } : blank);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const change = <K extends Field>(field: K, next: AddressInput[K]) => { setValue(current => ({ ...current, [field]: next })); setErrors(current => ({ ...current, [field]: undefined })); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); const problems = validate(value); setErrors(problems); setError(''); if (Object.keys(problems).length) return;
    setBusy(true);
    try { await onSave({ ...value, fullName: value.fullName.trim(), line1: value.line1.trim(), line2: value.line2?.trim() || null, city: value.city.trim(), state: value.state.trim() }); }
    catch (reason) { if (reason instanceof ApiError && reason.fields) setErrors(Object.fromEntries(Object.entries(reason.fields).map(([key, messages]) => [key, messages[0]]))); setError(reason instanceof Error ? reason.message : 'Could not save this address.'); }
    finally { setBusy(false); }
  };
  return <form className="store-address-form" onSubmit={submit} noValidate><h3>{title}</h3><div className="store-address-fields">
    <label>Full name <span>*</span><input value={value.fullName} onChange={event => change('fullName', event.target.value)} autoComplete="name" maxLength={100} aria-invalid={!!errors.fullName}/>{errors.fullName && <small role="alert">{errors.fullName}</small>}</label>
    <label>Phone number <span>*</span><input value={value.phone} onChange={event => change('phone', event.target.value.replace(/\D/g, '').slice(0, 10))} inputMode="tel" autoComplete="tel-national" maxLength={10} aria-invalid={!!errors.phone}/>{errors.phone && <small role="alert">{errors.phone}</small>}</label>
    <label className="store-field-wide">Address line 1 <span>*</span><input value={value.line1} onChange={event => change('line1', event.target.value)} autoComplete="address-line1" maxLength={200} aria-invalid={!!errors.line1}/>{errors.line1 && <small role="alert">{errors.line1}</small>}</label>
    <label className="store-field-wide">Address line 2 / landmark <em>Optional</em><input value={value.line2 ?? ''} onChange={event => change('line2', event.target.value)} autoComplete="address-line2" maxLength={200}/></label>
    <label>City <span>*</span><input value={value.city} onChange={event => change('city', event.target.value)} autoComplete="address-level2" maxLength={100} aria-invalid={!!errors.city}/>{errors.city && <small role="alert">{errors.city}</small>}</label>
    <label>State <span>*</span><input value={value.state} onChange={event => change('state', event.target.value)} autoComplete="address-level1" maxLength={100} aria-invalid={!!errors.state}/>{errors.state && <small role="alert">{errors.state}</small>}</label>
    <label>PIN code <span>*</span><input value={value.pinCode} onChange={event => change('pinCode', event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" autoComplete="postal-code" maxLength={6} aria-invalid={!!errors.pinCode}/>{errors.pinCode && <small role="alert">{errors.pinCode}</small>}</label>
    <label>Save as <select value={value.label ?? 'Other'} onChange={event => change('label', event.target.value as AddressInput['label'])}><option>Home</option><option>Office</option><option>Other</option></select></label>
  </div><label className="store-address-default"><input type="checkbox" checked={value.isDefault} onChange={event => change('isDefault', event.target.checked)}/> Make this my default address</label>{error && <p className="store-form-error" role="alert">{error}</p>}<div className="store-address-form-actions"><StoreCTA type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save address'}</StoreCTA><StoreCTA variant="secondary" onClick={onCancel} disabled={busy}>Cancel</StoreCTA></div></form>;
}
