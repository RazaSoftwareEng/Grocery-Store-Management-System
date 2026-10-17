import React, { useRef } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { Printer, Check, Plus } from 'lucide-react';
import { formatDate, formatNumber, isWeightedUnit } from '../../utils/formatters';
import { printElement } from '../../utils/print';
import { useStore } from '../../context/StoreContext';

// Printable width per paper (thermal rolls have ~4mm unprintable margin each side)
const PAPER = {
  thermal58: { width: '48mm', font: 10.5, big: 13 },
  thermal80: { width: '72mm', font: 12, big: 15 },
  a4: { width: '180mm', font: 13, big: 18 },
};

const METHOD_LABELS = { CASH: 'Cash', CARD: 'Card', ONLINE: 'Bank/Online', CREDIT: 'Khata (credit)', SPLIT: 'Split' };

const money = (n) =>
  (Number(n) || 0).toLocaleString('en-PK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ReceiptModal({ isOpen, onClose, saleData, isReprint = false }) {
  const { settings, currencySymbol } = useStore();
  const receiptRef = useRef(null);

  if (!saleData || !saleData.sale) return null;

  const sale = saleData.sale;
  const items = saleData.items || [];
  const payments = saleData.payments || [];
  const paper = PAPER[settings.receiptType] || PAPER.thermal80;
  const isA4 = settings.receiptType === 'a4';
  const balanceAfter = saleData.customerBalanceAfter;
  const showKhata = sale.customerId && sale.customerId !== 'WALK-IN' && balanceAfter !== null && balanceAfter !== undefined;
  const totalQty = items.reduce((t, i) => t + Number(i.quantity), 0);
  const saved = Number(sale.discount || 0) + Number(sale.lineDiscountTotal || 0);
  const returnedTotal = Number(sale.returnedTotal) || 0;
  const cur = currencySymbol || 'Rs.';

  const handlePrint = () => printElement(receiptRef.current, { pageSize: isA4 ? 'A4' : null, margin: isA4 ? '10mm' : '0' });

  // Inline styles so the paper prints the same on any printer
  const s = {
    paper: {
      width: paper.width,
      maxWidth: '100%',
      margin: '0 auto',
      padding: '3mm 2mm',
      background: '#fff',
      color: '#000',
      fontFamily: "'Courier New', Consolas, monospace",
      fontSize: `${paper.font}px`,
      lineHeight: 1.35,
    },
    center: { textAlign: 'center' },
    store: { fontSize: `${paper.big + 3}px`, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', lineHeight: 1.15 },
    rule: { borderTop: '1px dashed #000', margin: '5px 0' },
    ruleSolid: { borderTop: '2px solid #000', margin: '5px 0' },
    row: { display: 'flex', justifyContent: 'space-between', gap: '6px' },
    bold: { fontWeight: 700 },
    grand: { display: 'flex', justifyContent: 'space-between', fontSize: `${paper.big + 2}px`, fontWeight: 800, padding: '2px 0' },
    stamp: { textAlign: 'center', fontWeight: 800, border: '2px solid #000', padding: '2px 0', margin: '0 0 6px', letterSpacing: '2px' },
    small: { fontSize: `${paper.font - 1.5}px` },
    th: { fontWeight: 700, textAlign: 'right', padding: '0 0 2px' },
    td: { textAlign: 'right', verticalAlign: 'top', whiteSpace: 'nowrap', paddingLeft: '4px' },
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isReprint ? 'Reprint bill' : 'Sale completed'}
      subtitle={isReprint ? `Invoice ${sale.invoiceNumber}` : `Invoice ${sale.invoiceNumber} saved`}
      maxWidth={isA4 ? 'max-w-3xl' : 'max-w-md'}
      bodyClassName="p-3 sm:p-5 bg-slate-100"
      footer={
        <div className="w-full flex flex-wrap items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <div className="flex items-center gap-2">
            <Button variant={isReprint ? 'primary' : 'outline'} size="sm" icon={Printer} onClick={handlePrint} autoFocus>
              Print
            </Button>
            {!isReprint && (
              <Button variant="primary" size="sm" icon={Plus} onClick={onClose} className="font-semibold">
                New sale
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {!isReprint && (
          <div className="p-2.5 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2 text-xs font-semibold">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            Bill saved & stock updated
            {Number(sale.change) > 0 && <span className="ml-auto tabular">Change: {cur} {money(sale.change)}</span>}
          </div>
        )}

        <div className="shadow-md mx-auto" style={{ width: paper.width, maxWidth: '100%' }}>
          <div ref={receiptRef} style={s.paper}>
            {isReprint && <div style={s.stamp}>DUPLICATE COPY</div>}

            <div style={s.center}>
              <div style={s.store}>{settings.storeName}</div>
              {settings.tagline && <div style={s.small}>{settings.tagline}</div>}
              {settings.address && <div style={s.small}>{settings.address}</div>}
              {settings.phone && <div style={s.small}>Ph: {settings.phone}</div>}
              {settings.ntn && <div style={s.small}>NTN: {settings.ntn}</div>}
              {settings.strn && <div style={s.small}>STRN: {settings.strn}</div>}
            </div>

            <div style={s.ruleSolid} />
            <div style={{ ...s.center, ...s.bold, letterSpacing: '1px' }}>{Number(sale.tax) > 0 ? 'SALES TAX INVOICE' : 'CASH MEMO'}</div>
            <div style={s.ruleSolid} />

            <div style={s.row}><span>Bill #</span><span style={s.bold}>{sale.invoiceNumber}</span></div>
            <div style={s.row}><span>Date</span><span>{formatDate(sale.date || sale.createdAt)}</span></div>
            <div style={s.row}><span>Cashier</span><span>{sale.cashierName || '-'}</span></div>
            {sale.customerId && sale.customerId !== 'WALK-IN' && (
              <div style={s.row}><span>Customer</span><span style={s.bold}>{sale.customerName}</span></div>
            )}

            <div style={s.rule} />

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'inherit' }}>
              <thead>
                <tr>
                  <th style={{ ...s.th, textAlign: 'left' }}>Item</th>
                  <th style={s.th}>Qty</th>
                  <th style={s.th}>Rate</th>
                  <th style={s.th}>Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colSpan={4}><div style={{ ...s.rule, margin: '1px 0 3px' }} /></td></tr>
                {items.map((item, idx) => (
                  <React.Fragment key={item.saleItemId || idx}>
                    <tr>
                      <td colSpan={4} style={{ ...s.bold, paddingTop: idx ? '3px' : 0 }}>
                        {idx + 1}. {item.productName || item.name}
                      </td>
                    </tr>
                    <tr>
                      <td />
                      <td style={s.td}>
                        {formatNumber(item.quantity)}
                        {isWeightedUnit(item.unit) ? ` ${item.unit}` : ''}
                      </td>
                      <td style={s.td}>{money(item.unitPrice)}</td>
                      <td style={{ ...s.td, ...s.bold }}>{money(item.lineTotal)}</td>
                    </tr>
                    {Number(item.discount) > 0 && (
                      <tr><td colSpan={4} style={{ ...s.td, ...s.small }}>Discount -{money(item.discount)}</td></tr>
                    )}
                    {Number(item.returnedQty) > 0 && (
                      <tr><td colSpan={4} style={{ ...s.td, ...s.small }}>Returned {formatNumber(item.returnedQty)}</td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            <div style={s.rule} />
            <div style={s.row}><span>Items: {items.length}</span><span>Qty: {formatNumber(totalQty)}</span></div>
            <div style={s.rule} />

            <div style={s.row}><span>Subtotal</span><span>{money(sale.subtotal)}</span></div>
            {Number(sale.discount) > 0 && <div style={s.row}><span>Discount</span><span>-{money(sale.discount)}</span></div>}
            {Number(sale.tax) > 0 && <div style={s.row}><span>Sales tax ({settings.taxRate}%)</span><span>{money(sale.tax)}</span></div>}
            <div style={s.ruleSolid} />
            <div style={s.grand}><span>TOTAL</span><span>{cur} {money(sale.total)}</span></div>
            <div style={s.ruleSolid} />

            {payments.length > 0 ? (
              payments.map((p) => (
                <div key={p.paymentId || p.method} style={s.row}>
                  <span>{METHOD_LABELS[p.method] || p.method}{p.reference ? ` (${p.reference})` : ''}</span>
                  <span>{money(p.method === 'CASH' ? p.tendered : p.amount)}</span>
                </div>
              ))
            ) : (
              <div style={s.row}><span>Paid ({sale.paymentMethod})</span><span>{money(sale.amountPaid)}</span></div>
            )}
            {Number(sale.change) > 0 && (
              <div style={{ ...s.row, ...s.bold }}><span>Change</span><span>{money(sale.change)}</span></div>
            )}
            {returnedTotal > 0 && <div style={s.row}><span>Returned</span><span>-{money(returnedTotal)}</span></div>}
            {sale.status === 'CANCELLED' && <div style={{ ...s.center, ...s.bold, marginTop: '4px' }}>*** BILL CANCELLED ***</div>}

            {showKhata && (
              <>
                <div style={s.rule} />
                <div style={s.row}><span>Previous khata</span><span>{money(saleData.customerBalanceBefore)}</span></div>
                <div style={{ ...s.row, ...s.bold }}><span>Khata balance</span><span>{money(balanceAfter)}</span></div>
              </>
            )}

            {saved > 0 && (
              <>
                <div style={s.rule} />
                <div style={{ ...s.center, ...s.bold }}>You saved {cur} {money(saved)}</div>
              </>
            )}

            <div style={s.rule} />
            <div style={s.center}>
              <div style={s.bold}>{settings.receiptFooter || 'Thank you for shopping with us!'}</div>
              <div style={s.small}>Goods once sold can be exchanged with this bill.</div>
              {isReprint && <div style={s.small}>Reprinted {formatDate(new Date().toISOString())}</div>}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
