const CONFIG = {
  GAS_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbyA8sYGOb_QqotgF-I23ygcHhE4ytGmJk5Z4ifmcvSpbENFa5c9fgfhMDfrW9EYPv1Xlg/exec",
  WHATSAPP_NUMBER: "19726070561",
  // Si usas token en Apps Script, colócalo aquí y se agregará a la URL:
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
  const t = title.toLowerCase();
  if (t.includes("recibido") || t.includes("arlington")) return "📦";
  if (t.includes("ups") || t.includes("miami")) return "🚚";
  if (t.includes("vuelo") || t.includes("a ecuador") || t.includes("aéreo")) return "✈️";
  if (t.includes("consolidado") || t.includes("consolidación")) return "🧱";
  if (t.includes("aduana") || t.includes("liberación")) return "🛃";
  if (t.includes("disponible") || t.includes("entregado")) return "✅";
  return "📍";
}

async function fetchTracking(code){
  const url = new URL(CONFIG.GAS_WEB_APP_URL);
  url.searchParams.set("code", code.trim());
  if (CONFIG.TOKEN) url.searchParams.set("token", CONFIG.TOKEN);
  const res = await fetch(url, { method: "GET", cache: "no-store" });
  if(!res.ok) throw new Error("Error de servidor");
  return res.json();
}

function renderTimeline(timeline){
  const container = $("timeline");
  container.innerHTML = "";
  if(!timeline || !timeline.length){
    container.innerHTML = "<p>Sin eventos</p>";
    return;
  }
  // ordenar por fecha si viene fuera de orden
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
  const msg = encodeURIComponent(`Hola BELOURA, consulta sobre mi envío ${code}`);
  wa.href = `https://wa.me/${CONFIG.WHATSAPP_NUMBER}?text=${msg}`;
}

function showNotFound(){
  $("result").classList.add("hidden");
  $("notFound").classList.remove("hidden");
}

async function handleSearch(){
  const code = $("trackingInput").value.trim();
  if(!code || code.length < 8){
    alert("Ingresa tu número de guía BELOURA (ej.: BLRG123).");
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

window.addEventListener("DOMContentLoaded", ()=>{
  $("year").textContent = new Date().getFullYear();
  $("searchBtn").addEventListener("click", handleSearch);
  $("trackingInput").addEventListener("keydown", e=>{ if(e.key==="Enter") handleSearch(); });

  // Evita que el service worker antiguo sirva archivos cacheados (si usas SW)
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then(regs => regs.forEach(r => r.update()))
      .catch(()=>{});
  }
});
