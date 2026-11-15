/* ============================================================================
   Conexión directa entre los dos jugadores (WebRTC DataChannel) para el partido online.

   - Se negocia por el canal de la sala de Supabase (online.js reenvía las señales `rtc`).
   - Dos canales: "fast" (sin orden ni reintentos: snapshots e inputs, lo viejo no sirve) y "rel" (ordenado y confiable: acciones y eventos).
   - Si no se puede abrir (algunas redes/NAT lo bloquean), `send()` devuelve false y online.js manda por Supabase (relay): más lento pero anda siempre.
   ========================================================================== */

const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];
export const p2pSupported = () => typeof RTCPeerConnection !== 'undefined';

/**
 * opts = { initiator, signal(msg), onMessage(obj), onState(state) }
 * state: 'connecting' | 'p2p' | 'relay'
 */
export function createLink(opts) {
  const { initiator, signal, onMessage, onState } = opts;
  let pc = null, fast = null, rel = null, state = 'relay', closed = false, pendingIce = [], gotRemote = false, timer = 0;
  const setState = s => { if (s !== state) { state = s; try { onState?.(s); } catch { /* nada */ } } };
  const isOpen = ch => ch && ch.readyState === 'open';
  const check = () => setState(isOpen(fast) && isOpen(rel) ? 'p2p' : (pc && !closed && state !== 'p2p' ? 'connecting' : 'relay'));

  function wire(ch) {
    ch.onopen = check; ch.onclose = () => { check(); if (state !== 'p2p') setState('relay'); }; ch.onerror = () => { /* se reporta en onclose */ };
    ch.onmessage = e => { try { onMessage(JSON.parse(e.data)); } catch { /* mensaje roto: se ignora */ } };
  }
  function build() {
    pc = new RTCPeerConnection({ iceServers: ICE });
    pc.onicecandidate = e => { if (e.candidate) signal({ t: 'rtc', k: 'ice', d: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
    pc.onconnectionstatechange = () => { if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) setState('relay'); else check(); };
    pc.ondatachannel = e => { if (e.channel.label === 'fast') fast = e.channel; else if (e.channel.label === 'rel') rel = e.channel; else return; wire(e.channel); check(); };
    setState('connecting');
    clearTimeout(timer); timer = setTimeout(() => { if (state !== 'p2p') setState('relay'); }, 9000);     // si en 9 s no abrió, seguimos por Supabase
  }
  async function flushIce() { for (const c of pendingIce.splice(0)) { try { await pc.addIceCandidate(c); } catch { /* candidato viejo */ } } }

  const api = {
    get state() { return state; },
    get p2p() { return state === 'p2p'; },
    /** El anfitrión arranca la negociación. */
    async start() {
      if (!p2pSupported() || closed) return;
      try {
        build();
        if (initiator) {
          fast = pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 }); rel = pc.createDataChannel('rel', { ordered: true });
          wire(fast); wire(rel);
          const off = await pc.createOffer(); await pc.setLocalDescription(off);
          signal({ t: 'rtc', k: 'offer', d: { type: off.type, sdp: off.sdp } });
        }
      } catch (e) { console.warn('P2P no disponible, se usa Supabase:', e); setState('relay'); }
    },
    /** Llega una señal del otro lado. */
    async signal(m) {
      if (closed || !p2pSupported()) return;
      try {
        if (m.k === 'offer' && !initiator) {
          if (!pc) build();
          await pc.setRemoteDescription(m.d); gotRemote = true; await flushIce();
          const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
          signal({ t: 'rtc', k: 'answer', d: { type: ans.type, sdp: ans.sdp } });
        } else if (m.k === 'answer' && initiator && pc) {
          await pc.setRemoteDescription(m.d); gotRemote = true; await flushIce();
        } else if (m.k === 'ice' && pc) {
          if (gotRemote) { try { await pc.addIceCandidate(m.d); } catch { /* candidato viejo */ } } else pendingIce.push(m.d);
        }
      } catch (e) { console.warn('Señal P2P falló:', e); setState('relay'); }
    },
    /** Manda por el canal directo. Devuelve false si no se pudo (el que llama usa Supabase). */
    send(msg, reliable = false) {
      const ch = reliable ? rel : fast;
      if (state !== 'p2p' || !isOpen(ch)) return false;
      try {
        if (!reliable && ch.bufferedAmount > 200000) return true;          // red saturada: se descarta este snapshot (llega el siguiente)
        ch.send(JSON.stringify(msg)); return true;
      } catch { return false; }
    },
    close() {
      closed = true; clearTimeout(timer);
      try { fast?.close(); rel?.close(); pc?.close(); } catch { /* nada */ }
      fast = rel = pc = null; state = 'relay';
    },
  };
  return api;
}
