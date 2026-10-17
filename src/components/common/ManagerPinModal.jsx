import React, { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Input } from './Input';
import { api } from '../../services/api';

/**
 * Asks a store manager to type their PIN. On success calls
 * onApproved(token, approvedBy); the token is single-use and valid 5 minutes.
 */
export function ManagerPinModal({ isOpen, onClose, onApproved, reason }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
    }
  }, [isOpen]);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\d{4,8}$/.test(pin)) {
      setError('Enter the 4 to 8 digit manager PIN');
      return;
    }
    setIsChecking(true);
    const res = await api.verifyManagerPin(pin);
    setIsChecking(false);
    if (res.success) {
      onApproved(res.data.token, res.data.approvedBy);
    } else {
      setPin('');
      setError(res.error || 'Wrong manager PIN');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Manager approval needed"
      subtitle={reason}
      maxWidth="max-w-sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isChecking}>
            Cancel
          </Button>
          <Button type="submit" form="manager-pin-form" icon={ShieldCheck} isLoading={isChecking}>
            Approve
          </Button>
        </>
      }
    >
      <form id="manager-pin-form" onSubmit={submit} noValidate className="space-y-3">
        <p className="text-[13px] text-slate-600">Ask the store manager to enter their PIN on this screen.</p>
        <Input
          label="Manager PIN"
          type="password"
          inputMode="numeric"
          autoComplete="off"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
            setError('');
          }}
          error={error}
          autoFocus
          className="tracking-[0.4em] text-center text-lg"
        />
      </form>
    </Modal>
  );
}
