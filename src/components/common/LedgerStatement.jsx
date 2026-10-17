import React, { useEffect, useRef, useState } from 'react';
import { Printer, Download, MessageCircle } from 'lucide-react';
import { Button } from './Button';
import { useStore } from '../../context/StoreContext';
import { formatCurrency, formatDate, formatShortDate } from '../../utils/formatters';
import { addDays, todayStr } from '../../utils/dates';
import { printElement } from '../../utils/print';
import { exportToCsv } from '../../utils/exportCsv';

const TYPE_LABELS = {
  SALE_CREDIT: 'Credit sale',
  PAYMENT: 'Payment',
  RETURN: 'Return',
  ADJUSTMENT: 'Adjustment',
  OPENING: 'Opening balance',
  PURCHASE: 'Goods received',
};

/** Pakistani mobile numbers to wa.me format (03xx -> 923xx) */
function waNumber(phone) {
  let d = String(phone || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = `92${d.slice(1)}`;
  return d.length >= 11 ? d : '';
}

/**
 * Printable ledger (khata) statement with a date filter.
 * load(startDate, endDate) must resolve to { success, data: entries[] } in date order.
 */
export function LedgerStatement({ party, kind = 'customer', load, debitLabel = 'Debit', creditLabel = 'Credit' }) {
  const { settings, currencySymbol } = useStore();
  const [startDate, setStartDate] = useState(addDays(todayStr(), -89));
  const [endDate, setEndDate] = useState(todayStr());
  const [entries, setEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const ref = useRef(null);
  const f = (n) => formatCurrency(n, currencySymbol);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    load(startDate, endDate).then((res) => {
      if (cancelled) return;
      setIsLoading(false);
      if (res.success) setEntries(res.data || []);
    });
    return () => {
      cancelled = true;
    };
  }, [load, startDate, endDate]);

  const first = entries[0];
  const opening = first ? Number(first.balanceAfter) - Number(first.debit) + Number(first.credit) : Number(party.outstandingBalance) || 0;
  const closing = entries.length ? Number(entries[entries.length - 1].balanceAfter) : opening;
  const totalDebit = entries.reduce((s, e) => s + Number(e.debit), 0);
  const totalCredit = entries.reduce((s, e) => s + Number(e.credit), 0);

  const whatsappText = encodeURIComponent(
    `Assalam o Alaikum ${party.name},\n${settings.storeName} khata summary (${formatShortDate(startDate)} - ${formatShortDate(endDate)}):\n` +
      `Opening: ${f(opening)}\n${debitLabel}: ${f(totalDebit)}\n${creditLabel}: ${f(totalCredit)}\n` +
      `Balance now: ${f(party.outstandingBalance)}${Number(party.outstandingBalance) < 0 ? ' (advance)' : ''}\nShukriya.`
  );
  const wa = waNumber(party.phone);

  const exportCsv = () =>
    exportToCsv(`${kind}_statement_${party.name}`, [
      { key: 'createdAt', label: 'Date' },
      { key: 'typeLabel', label: 'Type' },
      { key: 'reference', label: 'Reference' },
      { key: 'paymentMethod', label: 'Method' },
      { key: 'debit', label: debitLabel },
      { key: 'credit', label: creditLabel },
      { key: 'balanceAfter', label: 'Balance' },
      { key: 'notes', label: 'Notes' },
    ], entries.map((e) => ({ ...e, typeLabel: TYPE_LABELS[e.type] || e.type })));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <input type="date" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} aria-label="From"
          className="h-[34px] px-2 text-[13px] border border-slate-300 rounded-lg" />
        <input type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} aria-label="To"
          className="h-[34px] px-2 text-[13px] border border-slate-300 rounded-lg" />
        <div className="flex-1" />
        <Button size="sm" variant="secondary" icon={Printer} onClick={() => printElement(ref.current, { pageSize: 'A4' })}>Print</Button>
        <Button size="sm" variant="secondary" icon={Download} onClick={exportCsv}>CSV</Button>
        {kind === 'customer' && (
          <a
            href={`https://wa.me/${wa}?text=${whatsappText}`}
            target="_blank"
            rel="noreferrer"
            className="h-[30px] px-3 inline-flex items-center gap-1.5 rounded-xl text-[13px] font-medium bg-[#25D366] text-white hover:opacity-90"
            title={wa ? 'Open WhatsApp with a summary' : 'No valid phone number; choose the contact in WhatsApp'}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </a>
        )}
      </div>

      <div ref={ref} className="bg-white">
        <div className="print-only mb-3 text-sm">
          <p className="font-semibold text-base">{settings.storeName}</p>
          <p>{settings.address} · {settings.phone}</p>
          <p className="mt-2 font-semibold">
            {kind === 'customer' ? 'Customer' : 'Supplier'} statement: {party.name} {party.phone ? `(${party.phone})` : ''}
          </p>
          <p>{formatShortDate(startDate)} to {formatShortDate(endDate)}</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 text-[13px]">
          <Box label="Opening" value={f(opening)} />
          <Box label={debitLabel} value={f(totalDebit)} />
          <Box label={creditLabel} value={f(totalCredit)} />
          <Box label="Closing" value={f(closing)} strong />
        </div>
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-[13px]">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Details</th>
                <th className="text-right px-3 py-2">{debitLabel}</th>
                <th className="text-right px-3 py-2">{creditLabel}</th>
                <th className="text-right px-3 py-2">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr className="text-slate-500">
                <td className="px-3 py-2">{formatShortDate(startDate)}</td>
                <td className="px-3 py-2" colSpan={3}>Opening balance</td>
                <td className="px-3 py-2 text-right tabular">{f(opening)}</td>
              </tr>
              {entries.map((e) => (
                <tr key={e.entryId}>
                  <td className="px-3 py-2 whitespace-nowrap text-xs">{formatDate(e.createdAt)}</td>
                  <td className="px-3 py-2">
                    <span className="font-medium">{TYPE_LABELS[e.type] || e.type}</span>
                    <span className="text-xs text-slate-500">
                      {' '}{e.reference}{e.paymentMethod && e.type === 'PAYMENT' ? ` · ${e.paymentMethod}` : ''}{e.notes ? ` · ${e.notes}` : ''}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular">{Number(e.debit) ? f(e.debit) : ''}</td>
                  <td className="px-3 py-2 text-right tabular text-brand-700">{Number(e.credit) ? f(e.credit) : ''}</td>
                  <td className="px-3 py-2 text-right tabular font-semibold">{f(e.balanceAfter)}</td>
                </tr>
              ))}
              {!entries.length && (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-slate-400">{isLoading ? 'Loading…' : 'No entries in this period'}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="print-only mt-3 text-xs">Negative balance = advance.</p>
      </div>
    </div>
  );
}

function Box({ label, value, strong }) {
  return (
    <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`tabular ${strong ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>{value}</p>
    </div>
  );
}
