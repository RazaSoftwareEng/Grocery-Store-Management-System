/**
 * Print one element of the page (receipt, report, statement) with window.print.
 * The element is copied into a top-level #print-root, so a scrolling modal or a
 * fixed-height panel can never cut it off. Everything else is hidden by the
 * `body.printing` rules in index.css.
 */
export function printElement(el, { pageSize, margin = '3mm' } = {}) {
  if (!el) {
    window.print();
    return;
  }

  document.getElementById('print-root')?.remove();
  const root = document.createElement('div');
  root.id = 'print-root';
  const copy = el.cloneNode(true);
  copy.removeAttribute('id');
  // receipts carry their own paper width; everything else fills the page
  if (!el.style.width) copy.style.width = '100%';
  copy.style.maxWidth = '100%';
  // keep typed values (counted qty etc.) in the copy
  const srcInputs = el.querySelectorAll('input, select, textarea');
  copy.querySelectorAll('input, select, textarea').forEach((node, i) => {
    node.setAttribute('value', srcInputs[i]?.value ?? '');
  });
  root.appendChild(copy);
  document.body.appendChild(root);

  const style = document.createElement('style');
  style.textContent = `@media print { @page { ${pageSize ? `size: ${pageSize};` : ''} margin: ${margin}; } }`;
  document.head.appendChild(style);
  document.body.classList.add('printing');

  let done = false;
  const cleanup = () => {
    if (done) return;
    done = true;
    document.body.classList.remove('printing');
    root.remove();
    style.remove();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);
  window.print();
  // some browsers do not fire afterprint reliably
  setTimeout(cleanup, 2000);
}

export const printById = (id, opts) => printElement(document.getElementById(id), opts);
