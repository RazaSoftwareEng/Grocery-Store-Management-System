/**
 * Hardware Barcode Scanner Listener
 * Retail USB/Bluetooth barcode scanners send rapid keystrokes (< 40ms apart)
 * followed by an Enter key.
 */

export function createBarcodeListener(onScan, options = {}) {
  const minLength = options.minLength || 4;
  const maxDelay = options.maxDelay || 50; // max ms between keystrokes for scanner
  let buffer = '';
  let lastKeyTime = Date.now();

  function handleKeyDown(event) {
    // If user is focused on a text input/textarea that is NOT the dedicated POS search,
    // we can still detect if it's rapid scanning vs human typing.
    const now = Date.now();
    const timeDiff = now - lastKeyTime;
    lastKeyTime = now;

    // If Enter key is pressed
    if (event.key === 'Enter') {
      if (buffer.length >= minLength) {
        event.preventDefault();
        const scannedCode = buffer.trim();
        buffer = '';
        onScan(scannedCode);
      } else {
        buffer = '';
      }
      return;
    }

    // Ignore modifier keys
    if (event.key.length > 1) {
      return;
    }

    // If gap between keys was too long, reset buffer (it was human typing)
    if (timeDiff > maxDelay && buffer.length > 0) {
      buffer = '';
    }

    buffer += event.key;
  }

  window.addEventListener('keydown', handleKeyDown);

  return function cleanup() {
    window.removeEventListener('keydown', handleKeyDown);
  };
}
