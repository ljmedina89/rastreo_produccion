/* =======================
   BELOURA • Rastreo (app.js)
   - Usa JSONP (sin CORS) contra Apps Script
   - Llama action=track
   - Normaliza respuesta a tu UI actual
   ======================= */

const CONFIG = {
  GAS_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbyA8sYGOb_QqotgF-I23ygcHhE4ytGmJk5Z4ifmcvSpbENFa5c9fgfhMDfrW9EYPv1Xlg/exec",
  WHATSAPP_NUMBER: "19726070561",
  // Si protegiste create/invoice con token, track normalmente es público.
  // Si tu backend exige token también para track, colócalo aquí:
  TOKEN: "" // ej: "MI_TOKEN_SECRETO"
};

function $(id){ return document.getElementById(id); }

function setLoading(on){
  const btn = $("searchBtn");
  if(!btn) return;
  btn.disabled = on;
  btn.textContent = on ? "Buscando..." : "🔍";
}

function fmtWeight(v){
  if (v == null || Number.isNaN(v)) return "—";
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(",", "."));
  return Number.isFinite(n) ? n.toFixed(2) : "—";
}
function fmtDate(s){
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleString();
}

function iconFor(title=""){
  const t = (title||"").toLowerCase();
  if (t.includes("recibido") || t.includes("arlington")) return "📦";
  if (t.includes("ups") || t.includes("miami") || t.includes("transito") || t.includes("tránsito")) return "🚚";
  if (t.includes("vuelo") || t.includes("ecuador") || t.includes("aéreo")) return "✈️";
  if (t.includes("consolidado") || t.includes("consolidación")) return "🧱";
  if (t.includes("aduana") || t.includes("liberación")) return "🛃";
  if (t.includes("entregado") || t.includes("disponible")) return "✅";
  return "📍";
}

/* =============== JSONP helper (evita CORS) =============== */
function jsonp(url, params = {}) {
  return new Promise((resolve, reject) => {
    const cb = 'cb_' + Math.random().toString(36).slice(2);
    params.callback = cb;
    const qs = Object.entries(params)
      .map(([k, v]) => k + '=' + encodeURIComponent(typeof v === 'string' ? v : JSON.stringify(v)))
      .join('&');
    const s = document.createElement('script');
    s.src = url + (url.includes('?') ? '&' : '?') + qs;
    s.onerror = () => reject(new Error('JSONP error'));
    window[cb] = (data) => { resolve(data); delete window[cb]; document.body.removeChild(s); };
    document.body.appendChild(s);
  });
}

/* =============== Backend call =============== */
async function fetchTracking(code){
  const params = { action: 'track', code: code.trim() };
  if (CONFIG.TOKEN) params.token = CONFIG.TOKEN;

  const res = await jsonp(CONFIG.GAS_WEB_APP_URL, params);

  // Si tu backend ya devuelve {found:bool,...} respétalo:
  if ('found' in res) return res;

  // Si devuelve el formato que te propuse: { ok, status, lastUpdate, timeline[] }
  if ('ok' in res) {
    return {
      found: !!res.ok,
      status: res.status || '—',
      client: res.client || '—',           // si no lo envías en track, queda —
      destination: res.destination || '—', // idem
      weight_lb: res.weight_lb ?? null,    // idem
      updated_at: res.lastUpdate || null,
      ups_tracking: res.ups || '',
      timeline: (res.timeline || []).map(ev => ({
        title: ev.estado || ev.title || 'Evento',
        date: ev.fecha || ev.date || '',
        description: ev.ubicacion || ev.description || ''
      }))
    };
  }

  // Cualquier otro formato: intenta normalizar lo mínimo
  return {
    found: false,
    status: '—',
    client: '—',
    destination: '—',
    weight_lb: null,
    updated_at: null,
    ups_tracking: '',
    timeline: []
  };
}

/* =============== Render =============== */
function renderTimeline(timeline){
  const container = $("timeline");
  container.innerHTML = "";
  if(!timeline || !timeline.length){
    container.innerHTML = "<p>Sin eventos</p>";
    return;
  }
  // ordenar por fecha asc o desc según prefieras (aquí asc)
  try { timeline = [...timeline].sort((a,b)=> new Date(a.date) - new Date(b.date)); } catch {}
  timeline.forEach(ev=>{
    const ico = iconFor(ev.title || "");
    const dateStr = ev.date ? fmtDate(ev.date) : "";
    const desc = ev.description ? `<div class="desc">${ev.description}</div>` : "";
    container.innerHTML += `
      <div class="step">
        <div class="bullet">${ico}</div>
        <div class="content">
          <div class="title">${ev.title || "Evento"}</div>
          <div class="date">${dateStr}</div>
          ${desc}
        </div>
      </div>`;
  });
}

function renderResult(data, code){
  $("notFound").classList.add("hidden");
  $("result").classList.remove("hidden");

  $("statusText").textContent  = data.status || "—";
  $("clientText").textContent  = data.client || "—";
  $("destText").textContent    = data.destination || "—";
  $("weightText").textContent  = fmtWeight(data.weight_lb);
  $("updatedText").textContent = fmtDate(data.updated_at);

  const ups = data.ups_tracking || "";
  $("upsText").innerHTML = ups
    ? `<a href="https://www.ups.com/track?loc=es_US&tracknum=${encodeURIComponent(ups)}" target="_blank" rel="noopener">${ups}</a>`
    : "—";

  renderTimeline(data.timeline);

  const wa = $("whatsappBtn");
  if (wa) {
    const msg = encodeURIComponent(`Hola BELOURA, consulta sobre mi envío ${code}`);
    wa.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${msg}`;
  }
}

function showNotFound(){
  $("result").classList.add("hidden");
  $("notFound").classList.remove("hidden");
}

/* =============== Search handler =============== */
async function handleSearch(){
  const code = $("trackingInput").value.trim().toUpperCase();
  if(!code || code.length < 4){
    alert("Ingresa tu número de guía BELOURA (ej.: BLRA456).");
    return;
  }
  setLoading(true);
  $("result").classList.add("hidden");
  $("notFound").classList.add("hidden");
  try{
    const data = await fetchTracking(code);
    if(data && data.found){ renderResult(data, code); } else { showNotFound(); }
  } catch(e){
    console.error(e);
    showNotFound();
  } finally {
    setLoading(false);
  }
}

/* =============== Bootstrap =============== */
window.addEventListener("DOMContentLoaded", ()=>{
  const y = $("year"); if (y) y.textContent = new Date().getFullYear();
  const btn = $("searchBtn"); if (btn) btn.addEventListener("click", handleSearch);
  const inp = $("trackingInput"); if (inp) inp.addEventListener("keydown", e=>{ if(e.key==="Enter") handleSearch(); });

  // Soporta ?code=BLR...
  try {
    const qp = new URLSearchParams(location.search);
    if (qp.has('code')) {
      const c = qp.get('code') || '';
      if (inp) inp.value = c;
      handleSearch();
    }
  } catch {}

  // Evita cache viejo de SW, si existía
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(regs => regs.forEach(r => r.update()))
      .catch(()=>{});
  }
});
