/* BELOURA • Rastreo minimal
   - Solo estado actual, última actualización y timeline
   - JSONP (evita CORS) → action=track
*/
const CONFIG = {
  GAS_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbyA8sYGOb_QqotgF-I23ygcHhE4ytGmJk5Z4ifmcvSpbENFa5c9fgfhMDfrW9EYPv1Xlg/exec",
  TOKEN: "" // normalmente NO se usa token para 'track'; déjalo vacío
};

const $ = (sel) => document.querySelector(sel);

function showMsg(text, ok=false){
  const el = $("#msg");
  el.textContent = text;
  el.style.display = "block";
  el.className = "alert " + (ok ? "ok" : "err");
}
function hideMsg(){ const el=$("#msg"); el.style.display="none"; }

function fmtDate(d){
  if(!d) return "—";
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleString('es-EC', { hour12:false });
}
function normalizeCode(s){
  return String(s||"").trim().toUpperCase().replace(/\s+/g,'');
}

/* ---------- JSONP helper ---------- */
function jsonp(url, params={}){
  return new Promise((resolve,reject)=>{
    const cb = 'cb_' + Math.random().toString(36).slice(2);
    params.callback = cb;
    const qs = Object.entries(params)
      .map(([k,v]) => k + '=' + encodeURIComponent(typeof v==='string' ? v : JSON.stringify(v)))
      .join('&');
    const scr = document.createElement('script');
    scr.src = url + (url.includes('?') ? '&' : '?') + qs;
    scr.onerror = ()=> reject(new Error('JSONP error'));
    window[cb] = (data)=>{ resolve(data); delete window[cb]; document.body.removeChild(scr); };
    document.body.appendChild(scr);
  });
}

/* ---------- Backend call ---------- */
async function fetchTrack(code){
  const params = { action:'track', code };
  if (CONFIG.TOKEN) params.token = CONFIG.TOKEN;
  const res = await jsonp(CONFIG.GAS_WEB_APP_URL, params);

  // Soporta ambos formatos:
  // A) { ok:true, status, lastUpdate, timeline:[{fecha,estado}] }
  // B) { found:true, status, updated_at, timeline:[{date,title}] }
  if (res && res.ok) {
    return {
      found: true,
      status: res.status || "—",
      lastUpdate: res.lastUpdate || null,
      timeline: (res.timeline || []).map(ev => ({
        date: ev.fecha || ev.date || null,
        title: ev.estado || ev.title || ""
      }))
    };
  }
  if (res && res.found) {
    return {
      found: true,
      status: res.status || "—",
      lastUpdate: res.updated_at || null,
      timeline: (res.timeline || []).map(ev => ({
        date: ev.date || null,
        title: ev.title || ev.estado || ""
      }))
    };
  }
  return { found:false, status:"—", lastUpdate:null, timeline:[] };
}

/* ---------- Render ---------- */
function renderTrack(data){
  $("#estado").textContent = data.status || "—";
  $("#ultima").textContent = fmtDate(data.lastUpdate);

  const list = $("#timeline");
  list.innerHTML = "";

  const events = (data.timeline || [])
    .filter(e => e && (e.title || e.date))
    .sort((a,b)=> new Date(b.date||0) - new Date(a.date||0)); // más reciente arriba

  if (!events.length){
    list.innerHTML = `<li class="item"><div class="s">Sin eventos</div></li>`;
    return;
  }

  const frag = document.createDocumentFragment();
  for (const ev of events){
    const li = document.createElement('li');
    li.className = "item";
    li.innerHTML = `
      <div class="t">${ev.title || "Evento"}</div>
      <div class="s">${fmtDate(ev.date)}</div>
    `;
    frag.appendChild(li);
  }
  list.appendChild(frag);
}

/* ---------- UI ---------- */
async function doSearch(){
  hideMsg();
  const raw = $("#codeInput")?.value || "";
  const code = normalizeCode(raw);
  if (!code){ showMsg("Ingresa tu número de guía."); return; }

  $("#estado").textContent = "Buscando…";
  $("#ultima").textContent = "—";
  $("#timeline").innerHTML = "";

  try{
    const data = await fetchTrack(code);
    if (!data.found) { showMsg("No encontrado o sin registros."); return; }
    renderTrack(data);
  }catch(err){
    console.error(err);
    showMsg("No se pudo consultar el rastreo.");
  }
}

window.addEventListener('DOMContentLoaded', ()=>{
  $("#year").textContent = new Date().getFullYear();
  $("#searchBtn").addEventListener('click', doSearch);
  $("#codeInput").addEventListener('keydown', e=>{ if(e.key==='Enter') doSearch(); });

  // ?code=BLR-XXXX
  try{
    const qs = new URLSearchParams(location.search);
    if (qs.has('code')){
      const c = qs.get('code') || "";
      $("#codeInput").value = c;
      doSearch();
    }
  }catch{}

  // Limpia SW antiguos si tuvieses
  if ('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.update())).catch(()=>{});
  }
});
