/* Lector mínimo de ZIP (solo archivos SIN comprimir, "Store"): baja ultimate/cards.zip una vez y arma una URL
   (blob:) por carta. Así las 524 cartas viajan en UN archivo y no hace falta subirlas sueltas a GitHub.
   Si el zip no está o falla, el juego usa las cartas sueltas en ultimate/cards/<id>.webp como antes. */
const MAP = new Map();
export const cardsReady = (async () => {
  try {
    const r = await fetch('ultimate/cards.zip');
    if (!r.ok) return;
    const buf = await r.arrayBuffer(), dv = new DataView(buf), u8 = new Uint8Array(buf);
    let e = buf.byteLength - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;           // fin del directorio central
    if (e < 0) return;
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), size = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lh = dv.getUint32(p + 42, true);
      const name = new TextDecoder().decode(u8.subarray(p + 46, p + 46 + nl)).split('/').pop();
      p += 46 + nl + xl + cl;
      if (method !== 0 || !name.endsWith('.webp')) continue;
      const start = lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true);
      MAP.set(name.slice(0, -5), URL.createObjectURL(new Blob([u8.subarray(start, start + size)], { type: 'image/webp' })));
    }
  } catch (err) { console.warn('cards.zip no se pudo leer; uso las cartas sueltas', err); }
})();
export const cardUrl = id => MAP.get(id) || `ultimate/cards/${id}.webp`;
