/**
 * Builds the counter cashier's "today" summary from a list of sales.
 * Shared by the Supabase and Google Sheets / local demo services.
 */

function isSameLocalDay(dateValue, ref = new Date()) {
  const d = new Date(dateValue);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function buildCashierSummary(sales, cashierId) {
  const todaySales = sales
    .filter((s) => (!cashierId || s.cashierId === cashierId) && isSameLocalDay(s.date || s.createdAt))
    .sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

  const completed = todaySales.filter((s) => s.status === 'COMPLETED');
  const sumBy = (list) => list.reduce((sum, s) => sum + (Number(s.total) || 0), 0);

  return {
    totalSales: sumBy(completed),
    billCount: completed.length,
    cashTotal: sumBy(completed.filter((s) => s.paymentMethod === 'CASH')),
    creditTotal: sumBy(completed.filter((s) => s.paymentMethod === 'CREDIT')),
    otherTotal: sumBy(completed.filter((s) => s.paymentMethod !== 'CASH' && s.paymentMethod !== 'CREDIT')),
    cancelledCount: todaySales.length - completed.length,
    sales: todaySales,
  };
}
