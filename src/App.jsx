import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// ══════════════════════════════════════════
// RENK PALETİ
// ══════════════════════════════════════════
const C = {
  bg:"#060C18", card:"#0C1628", elev:"#0F1C30", hov:"#132040",
  b:"#1A2D48", bL:"#223860",
  blue:"#3B82F6", blueL:"#60A5FA",
  purple:"#8B5CF6", purpleL:"#A78BFA",
  green:"#10B981", greenL:"#34D399",
  amber:"#F59E0B", amberL:"#FCD34D",
  red:"#EF4444", redL:"#FCA5A5",
  teal:"#14B8A6", tealL:"#2DD4BF",
  txt:"#E2E8F0", muted:"#64748B", dim:"#94A3B8",
};

// ══════════════════════════════════════════
// YARDIMCI FONKSİYONLAR
// ══════════════════════════════════════════
const trN = (s = "") =>
  s.toLowerCase()
    .replace(/ğ/g,"g").replace(/ü/g,"u").replace(/ş/g,"s")
    .replace(/ı/g,"i").replace(/ö/g,"o").replace(/ç/g,"c").trim();

const uid = (...args) => {
  const str = args.map(a => String(a ?? "").toLowerCase().trim()).join("|");
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16).padStart(8, "0").slice(0, 12);
};

const money = (n, b = "TL") => {
  if (!n && n !== 0) return "—";
  const s = { TL:"₺", EUR:"€", USD:"$" }[b] ?? b;
  if (n >= 1_000_000) return `${(n/1_000_000).toFixed(2)}M ${s}`;
  if (n >= 1_000)     return `${Math.round(n/1_000)}K ${s}`;
  return `${n.toLocaleString("tr-TR")} ${s}`;
};

const now = () =>
  new Date().toLocaleString("tr-TR", {
    day:"2-digit", month:"2-digit", year:"numeric",
    hour:"2-digit", minute:"2-digit",
  });

const parseNum = str =>
  parseFloat(String(str ?? "").replace(/\./g,"").replace(",",".")) || null;

// ══════════════════════════════════════════
// EŞLEŞTİRME MOTORU
// ══════════════════════════════════════════
const W = { b:0.40, l:0.30, o:0.20, t:0.10 };

const scoreBudget = (max, price) => {
  if (!max || !price) return 0.5;
  const r = price / max;
  if (r <= 0.70) return 0.65;
  if (r <= 1.00) return 1 - (1 - r) * 0.25;
  if (r <= 1.10) return 1 - ((r - 1) / 0.1) * 0.55;
  return Math.max(0, 0.45 - (r - 1.1) * 2);
};
const scoreLoc = (bolge = "", ilce = "", mah = "") => {
  if (!bolge) return 0.25;
  const b = trN(bolge), il = trN(ilce), m = trN(mah);
  if (b === il || b === m) return 1;
  const parts = b.split(/[,/|]/);
  if (parts.some(p => { const pt = p.trim(); return pt && (il.includes(pt) || m.includes(pt)); })) return 0.68;
  return 0;
};
const scoreRoom = (a = "", b = "") => {
  const n = s => { const m = s?.match(/(\d+)\+/); return m ? +m[1] : 0; };
  const ta = n(a), tb = n(b);
  if (!ta || !tb) return 0.5;
  const d = Math.abs(ta - tb);
  return d === 0 ? 1 : d === 1 ? 0.55 : d === 2 ? 0.2 : 0;
};
const scoreType = (tI = "", pI = "", tT = "", pT = "") => {
  const im = !tI || !pI || trN(tI) === trN(pI);
  const tm = !tT || !pT || trN(tT) === trN(pT);
  return Math.min(1, (im ? 0.6 : 0) + (tm ? 0.4 : 0.1));
};

const runMatch = (talep, portfoyler, topN = 5, minS = 0.38) =>
  portfoyler
    .filter(p => !(talep.islem_tipi && p.islem_tipi && trN(talep.islem_tipi) !== trN(p.islem_tipi)))
    .map(p => {
      const b = scoreBudget(talep.butce_max_tl, p.fiyat_tl ?? p.fiyat);
      const l = scoreLoc(talep.bolge, p.ilce, p.mahalle);
      const o = scoreRoom(talep.oda_sayisi, p.oda_sayisi);
      const t = scoreType(talep.islem_tipi, p.islem_tipi, talep.tur, p.tur);
      return { portfoy: p, skor: b*W.b + l*W.l + o*W.o + t*W.t, b, l, o, t };
    })
    .filter(r => r.skor >= minS)
    .sort((a, b) => b.skor - a.skor)
    .slice(0, topN);

// ══════════════════════════════════════════
// WHATSAPP PARSER
// ══════════════════════════════════════════
const WA_JUNK = /gruba eklendi|Medya dahil|davet bağlantısıyla|kişisini ekledi|ayrıldı|grubun ayarlarını|numarasını değiştirdi|Mesaj bekleniyor|Bu mesaj silindi|uçtan uca|Güvenlik kodu|Görüntülü arama|Sesli arama/i;
const WA_LINE = /(?:\[)?(\d{1,2}[./]\d{1,2}[./]\d{2,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?)(?:\])?\s*[-–]\s*([^:]+):\s*(.*)/;

const parseWA = txt => {
  const msgs = []; let cur = null;
  for (const line of txt.split("\n")) {
    const s = line.trim();
    if (!s || WA_JUNK.test(s)) continue;
    const m = WA_LINE.exec(s);
    if (m) {
      if (cur && cur.m.length > 8) msgs.push(cur);
      cur = { z: `${m[1]} ${m[2]}`, g: m[3].trim(), m: m[4].trim() };
    } else if (cur) cur.m += " " + s;
  }
  if (cur && cur.m.length > 8) msgs.push(cur);
  return msgs;
};

// ══════════════════════════════════════════
// AI ÇAĞRILARI — GOOGLE GEMINI (ÜCRETSİZ)
// ══════════════════════════════════════════
const PARSE_PROMPT = `Sen bir Antalya gayrimenkul uzmanısın. WhatsApp mesajlarını analiz edip SADECE geçerli JSON Array döndürürsün. Açıklama veya markdown YAZMA.

PORTFÖY (ilan → tip:"portfoy"):
{"tip":"portfoy","Islem_Tipi":"Satılık"|"Kiralık"|"Devren","Tur":"Daire"|"Villa"|"Arsa"|"Ticari","Ilce":string|null,"Mahalle":string|null,"Oda_Sayisi":string|null,"Fiyat_Orijinal":number|null,"Para_Birimi":"TL"|"EUR"|"USD","Ozellikler":string|null,"Iletisim":string|null}

TALEBİ (alıcı → tip:"talep"):
{"tip":"talep","Islem_Tipi":"Satılık"|"Kiralık","Tur":"Daire"|"Villa"|"Arsa"|"Ticari","Bolge":string|null,"Oda_Sayisi":string|null,"Butce_Max":number|null,"Para_Birimi":"TL"|"EUR"|"USD","Iletisim":string|null}

KURALLAR: Sadece rakam (4 milyon→4000000). Bilinmeyenler null. Selamlama/link atla. Çoklu ilan ayrı obje.`;

const geminiCall = async (prompt, key) => {
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4000 },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT",   threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH",  threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
        ],
      }),
    }
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 120)}`);
  const d = await r.json();
  const txt = d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  return txt;
};

const geminiParse = async (text, key) => {
  const raw = await geminiCall(PARSE_PROMPT + "\n\nAnaliz et:\n\n" + text, key);
  const cleaned = raw.replace(/^```(?:json)?\s*/m, "").replace(/\s*```$/m, "").trim();
  try { const p = JSON.parse(cleaned); return Array.isArray(p) ? p : [p]; }
  catch { const m = cleaned.match(/\[[\s\S]*\]/); return m ? JSON.parse(m[0]) : []; }
};

const geminiMsg = async (talep, portfoy, key) => {
  const p = `Türkçe, 3-4 cümle profesyonel WhatsApp tanışma mesajı yaz.
Alıcı: ${talep.bolge || "—"} bölgesinde ${talep.oda_sayisi || ""} arıyor, max bütçe ${money(talep.butce_max_tl)}.
Portföy: ${portfoy.ilce || "—"}/${portfoy.mahalle || "—"}, ${portfoy.oda_sayisi || ""}, ${money(portfoy.fiyat, portfoy.para_birimi)}.
${portfoy.ozellikler ? "Özellikler: " + portfoy.ozellikler : ""}
Sadece mesajı yaz, başlık veya açıklama ekleme.`;
  return geminiCall(p, key);
};

// ══════════════════════════════════════════
// GOOGLE SHEETS API (Apps Script üzerinden)
// ══════════════════════════════════════════
const sheetsAPI = async (url, action, payload = {}) => {
  if (!url) return null;
  try {
    const r = await fetch(url, {
      method: "POST",
      body: JSON.stringify({ action, ...payload }),
      redirect: "follow",
    });
    const txt = await r.text();
    return JSON.parse(txt);
  } catch { return null; }
};

// ══════════════════════════════════════════
// CSS
// ══════════════════════════════════════════
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;overflow:hidden;}
body{background:${C.bg};color:${C.txt};font-family:'Outfit',sans-serif;}
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:${C.b};border-radius:2px;}
input,textarea,select{
  background:#07101E;border:1px solid ${C.b};color:${C.txt};
  border-radius:8px;padding:9px 12px;font-family:inherit;
  font-size:13px;width:100%;transition:border-color .18s;outline:none;
}
input:focus,textarea:focus,select:focus{border-color:${C.blue};box-shadow:0 0 0 3px rgba(59,130,246,.12);}
input::placeholder,textarea::placeholder{color:#243040;}
select option{background:${C.card};}
button{cursor:pointer;font-family:inherit;}
textarea{resize:vertical;line-height:1.65;}
.mono{font-family:'JetBrains Mono',monospace;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes popIn{from{opacity:0;transform:scale(.92)}to{opacity:1;transform:scale(1)}}
@keyframes slideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
`;

// ══════════════════════════════════════════
// UI PRİMİTİVLERİ
// ══════════════════════════════════════════

// Puan Halkası
const Ring = ({ skor }) => {
  const pct = Math.round((skor ?? 0) * 100);
  const col = pct >= 75 ? C.green : pct >= 55 ? C.amber : C.red;
  const r = 22, circ = 2 * Math.PI * r;
  return (
    <div style={{ position:"relative", width:56, height:56, flexShrink:0 }}>
      <svg width={56} height={56} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={28} cy={28} r={r} fill="none" stroke={C.b} strokeWidth={4}/>
        <circle cx={28} cy={28} r={r} fill="none" stroke={col} strokeWidth={4}
          strokeDasharray={`${circ*(pct/100)} ${circ}`} strokeLinecap="round"
          style={{ transition:"stroke-dasharray .6s cubic-bezier(.4,0,.2,1)" }}/>
      </svg>
      <span style={{ position:"absolute", inset:0, display:"flex", alignItems:"center",
        justifyContent:"center", fontSize:12, fontWeight:800, color:col }}>{pct}%</span>
    </div>
  );
};

// Puan Barı
const SBar = ({ label, score, w }) => {
  const pct = Math.round((score ?? 0) * 100);
  const col = pct >= 75 ? C.green : pct >= 55 ? C.amber : C.red;
  return (
    <div style={{ marginBottom:6 }}>
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 }}>
        <span style={{ color:C.muted }}>{label}<span style={{ opacity:.5 }}> ×{w}</span></span>
        <span style={{ color:col, fontWeight:700 }}>{pct}%</span>
      </div>
      <div style={{ height:4, background:C.elev, borderRadius:2, overflow:"hidden" }}>
        <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,${col}80,${col})`,
          borderRadius:2, transition:"width .5s cubic-bezier(.4,0,.2,1)" }}/>
      </div>
    </div>
  );
};

// Rozet
const Bdg = ({ children, c="blue", xs }) => {
  const M = {
    blue:  { bg:"rgba(59,130,246,.1)",  txt:"#60A5FA", br:"rgba(59,130,246,.22)" },
    purple:{ bg:"rgba(139,92,246,.1)",  txt:"#A78BFA", br:"rgba(139,92,246,.22)" },
    green: { bg:"rgba(16,185,129,.1)",  txt:"#34D399", br:"rgba(16,185,129,.22)" },
    amber: { bg:"rgba(245,158,11,.1)",  txt:"#FCD34D", br:"rgba(245,158,11,.22)" },
    red:   { bg:"rgba(239,68,68,.1)",   txt:"#FCA5A5", br:"rgba(239,68,68,.22)"  },
    gray:  { bg:"rgba(100,116,139,.08)",txt:"#94A3B8", br:"rgba(100,116,139,.2)" },
    teal:  { bg:"rgba(20,184,166,.1)",  txt:"#2DD4BF", br:"rgba(20,184,166,.22)" },
  };
  const m = M[c] ?? M.gray;
  return <span style={{ background:m.bg, color:m.txt, border:`1px solid ${m.br}`,
    borderRadius:20, padding:xs?"1px 7px":"3px 10px", fontSize:xs?10:11,
    fontWeight:600, whiteSpace:"nowrap", display:"inline-block" }}>{children}</span>;
};

// Kart
const Kart = ({ children, style={}, onClick, glass }) => {
  const [h, sH] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => (onClick||glass) && sH(true)}
      onMouseLeave={() => sH(false)}
      style={{ background:h ? C.hov : C.card, border:`1px solid ${h ? C.bL : C.b}`,
        borderRadius:12, padding:20, transition:"all .18s",
        cursor:onClick?"pointer":"default", animation:"fadeUp .3s ease", ...style }}>
      {children}
    </div>
  );
};

// Buton
const Btn = ({ children, onClick, v="primary", sz="md", disabled, loading, style={}, icon, full }) => {
  const [h, sH] = useState(false);
  const BG = {
    primary: { bg: h?"#2563EB":"linear-gradient(135deg,#1D4ED8,#3B82F6)", c:"#fff", b:"none" },
    purple:  { bg: h?"#7C3AED":"linear-gradient(135deg,#6D28D9,#8B5CF6)", c:"#fff", b:"none" },
    green:   { bg: h?"#059669":"linear-gradient(135deg,#047857,#10B981)", c:"#fff", b:"none" },
    amber:   { bg: h?"#D97706":"linear-gradient(135deg,#B45309,#F59E0B)", c:"#fff", b:"none" },
    red:     { bg: h?"#DC2626":"linear-gradient(135deg,#B91C1C,#EF4444)", c:"#fff", b:"none" },
    teal:    { bg: h?"#0D9488":"linear-gradient(135deg,#0F766E,#14B8A6)", c:"#fff", b:"none" },
    ghost:   { bg: h?"#132040":"transparent", c:C.dim, b:`1px solid ${C.b}` },
    outline: { bg: h?"rgba(59,130,246,.1)":"transparent", c:"#60A5FA", b:"1px solid rgba(59,130,246,.3)" },
    danger:  { bg: h?"rgba(239,68,68,.15)":"transparent", c:"#FCA5A5", b:"1px solid rgba(239,68,68,.25)" },
  };
  const s = BG[v] ?? BG.ghost;
  const P = { xs:"3px 9px", sm:"6px 14px", md:"9px 19px", lg:"12px 26px" }[sz];
  const F = { xs:10, sm:12, md:13, lg:14 }[sz];
  return (
    <button onClick={onClick} disabled={disabled || loading}
      onMouseEnter={() => sH(true)} onMouseLeave={() => sH(false)}
      style={{ background:disabled?"#131E30":s.bg, color:disabled?"#2A3E58":s.c,
        border:s.b, borderRadius:8, padding:P, fontSize:F, fontWeight:600,
        display:"inline-flex", alignItems:"center", gap:6, transition:"all .15s",
        opacity:disabled?.5:1, width:full?"100%":undefined,
        justifyContent:full?"center":undefined,
        transform:h&&!disabled?"translateY(-1px)":"none", ...style }}>
      {loading && <span style={{ width:12, height:12, border:"2px solid rgba(255,255,255,.2)",
        borderTopColor:"#fff", borderRadius:"50%", animation:"spin .65s linear infinite", flexShrink:0 }}/>}
      {!loading && icon}
      <span>{children}</span>
    </button>
  );
};

// Modal
const Modal = ({ title, children, onClose, width=560 }) => (
  <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.85)",
    backdropFilter:"blur(10px)", zIndex:1000, display:"flex",
    alignItems:"center", justifyContent:"center", padding:16 }}
    onClick={e => e.target === e.currentTarget && onClose()}>
    <div style={{ background:C.card, border:`1px solid ${C.b}`, borderRadius:16,
      width:"100%", maxWidth:width, maxHeight:"90vh", overflow:"auto",
      animation:"popIn .2s ease" }}>
      {title && (
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
          padding:"18px 22px", borderBottom:`1px solid ${C.b}`,
          position:"sticky", top:0, background:C.card, zIndex:1 }}>
          <h3 style={{ fontSize:15, fontWeight:700 }}>{title}</h3>
          <button onClick={onClose} style={{ background:C.elev, border:`1px solid ${C.b}`,
            color:C.muted, borderRadius:6, width:28, height:28, display:"flex",
            alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:18 }}>×</button>
        </div>
      )}
      <div style={{ padding:22 }}>{children}</div>
    </div>
  </div>
);

// Toast
const Toast = ({ message, type="success", onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, []);
  const col = { success:C.green, error:C.red, info:C.blue, warning:C.amber }[type];
  const ico = { success:"✓", error:"✕", info:"ℹ", warning:"⚠" }[type];
  return (
    <div style={{ background:C.card, border:`1px solid ${col}22`,
      borderLeft:`3px solid ${col}`, borderRadius:10,
      padding:"12px 16px", minWidth:280, maxWidth:380,
      display:"flex", alignItems:"flex-start", gap:10,
      animation:"slideUp .3s ease", boxShadow:"0 12px 40px rgba(0,0,0,.7)" }}>
      <span style={{ color:col, fontSize:14, fontWeight:800, flexShrink:0 }}>{ico}</span>
      <span style={{ fontSize:13, flex:1, lineHeight:1.5 }}>{message}</span>
      <button onClick={onClose} style={{ background:"none", border:"none", color:C.muted, cursor:"pointer", fontSize:16 }}>×</button>
    </div>
  );
};

// Form Alanı
const F = ({ label, hint, children }) => (
  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
    {label && <label style={{ fontSize:11, fontWeight:700, color:C.muted,
      textTransform:"uppercase", letterSpacing:".6px" }}>{label}</label>}
    {children}
    {hint && <p style={{ fontSize:11, color:"#243040" }}>{hint}</p>}
  </div>
);

const FG = ({ children, cols=2 }) => (
  <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols},1fr)`, gap:14 }}>{children}</div>
);

const Div = ({ label }) => (
  <div style={{ display:"flex", alignItems:"center", gap:12, margin:"16px 0" }}>
    <div style={{ flex:1, height:1, background:C.b }}/>
    {label && <span style={{ fontSize:11, color:C.muted, whiteSpace:"nowrap" }}>{label}</span>}
    {label && <div style={{ flex:1, height:1, background:C.b }}/>}
  </div>
);

// Stat Kart
const StatKart = ({ label, value, icon, color, sub }) => (
  <Kart style={{ position:"relative", overflow:"hidden" }}>
    <div style={{ position:"absolute", inset:0,
      background:`radial-gradient(circle at 95% 5%,${color}14,transparent 60%)`,
      pointerEvents:"none" }}/>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
      <span style={{ fontSize:12, color:C.muted }}>{label}</span>
      <div style={{ width:36, height:36, borderRadius:10, background:`${color}18`,
        display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>{icon}</div>
    </div>
    <div style={{ fontSize:32, fontWeight:800, color, lineHeight:1, marginBottom:4 }}>{value}</div>
    {sub && <div style={{ fontSize:12, color:C.muted }}>{sub}</div>}
  </Kart>
);

// API Durum
const ApiStatus = ({ sheetsOk, geminiOk, syncing }) => (
  <div style={{ display:"flex", gap:7, alignItems:"center" }}>
    {[
      { ok:sheetsOk, label:"Sheets", syncing },
      { ok:geminiOk, label:"Gemini", syncing:false },
    ].map(({ ok, label, syncing:s }) => (
      <div key={label} style={{ display:"flex", alignItems:"center", gap:5,
        background:C.elev, border:`1px solid ${C.b}`, borderRadius:6, padding:"3px 9px" }}>
        <span style={{ width:6, height:6, borderRadius:"50%",
          background:ok ? C.green : C.amber,
          animation:s?"pulse 1s infinite":"none" }}/>
        <span style={{ fontSize:10, color:ok ? C.greenL : C.amberL, fontWeight:600 }}>
          {label} {ok?"✓":"—"}
        </span>
      </div>
    ))}
  </div>
);

// ══════════════════════════════════════════
// SAYFA: DASHBOARD
// ══════════════════════════════════════════
const PageDashboard = ({ portfoyler, talepler, eslesmeler, deals, activities, goTo }) => {
  const topE    = [...eslesmeler].sort((a,b) => b.skor - a.skor).slice(0, 5);
  const openT   = talepler.filter(t => t.eslesme_durumu === "Bekliyor").length;
  const highM   = eslesmeler.filter(e => e.skor >= .75).length;
  const closedV = deals.filter(d => d.stage === "closed").reduce((s,d) => s + (d.deger||0), 0);
  const PIE_C   = [C.blue, C.purple, C.green, C.amber, C.teal, C.red];

  const ilceMap = {}; portfoyler.forEach(p => { const k = p.ilce||"Diğer"; ilceMap[k]=(ilceMap[k]||0)+1; });
  const ilceData = Object.entries(ilceMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value])=>({name,value}));
  const turMap = {}; portfoyler.forEach(p => { const k = p.tur||"Diğer"; turMap[k]=(turMap[k]||0)+1; });
  const turData = Object.entries(turMap).map(([name,value]) => ({name,value}));

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:18 }}>
      {/* KPI */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(170px,1fr))", gap:14 }}>
        <StatKart label="Toplam Portföy"  value={portfoyler.length}                      icon="🏠" color={C.blue}   sub={`${portfoyler.filter(p=>p.islem_tipi==="Satılık").length} satılık`}/>
        <StatKart label="Açık Talep"      value={openT}                                  icon="🔍" color={C.purple} sub="bekleyen müşteri"/>
        <StatKart label="Eşleşme"         value={eslesmeler.length}                       icon="🤝" color={C.green}  sub={`${highM} yüksek uyum`}/>
        <StatKart label="Pipeline Değeri" value={money(closedV||0)}                       icon="💰" color={C.amber}  sub="kapanan deal"/>
        <StatKart label="Ort. Uyum"       value={eslesmeler.length ? `${Math.round(eslesmeler.reduce((s,e)=>s+e.skor,0)/eslesmeler.length*100)}%` : "—"} icon="📊" color={C.teal}/>
      </div>
      {/* Grafikler */}
      <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr", gap:16 }}>
        <Kart style={{ padding:"18px 18px 8px" }}>
          <h3 style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:14, textTransform:"uppercase", letterSpacing:".6px" }}>📍 İlçe Bazlı Portföy</h3>
          {ilceData.length === 0
            ? <p style={{ color:C.muted, textAlign:"center", padding:40, fontSize:13 }}>Henüz portföy yok</p>
            : <ResponsiveContainer width="100%" height={170}>
                <BarChart data={ilceData} margin={{ left:-24, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.b} vertical={false}/>
                  <XAxis dataKey="name" tick={{ fill:C.muted, fontSize:10 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:C.muted, fontSize:10 }} axisLine={false} tickLine={false}/>
                  <Tooltip contentStyle={{ background:C.card, border:`1px solid ${C.b}`, borderRadius:8, fontSize:12 }}/>
                  <Bar dataKey="value" fill={C.blue} radius={[4,4,0,0]} name="İlan"/>
                </BarChart>
              </ResponsiveContainer>}
        </Kart>
        <Kart style={{ padding:"18px 18px 8px" }}>
          <h3 style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:14, textTransform:"uppercase", letterSpacing:".6px" }}>🏢 Emlak Türü</h3>
          {turData.length === 0
            ? <p style={{ color:C.muted, textAlign:"center", padding:40, fontSize:13 }}>Veri yok</p>
            : <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={turData} cx="50%" cy="50%" innerRadius={36} outerRadius={60} dataKey="value" paddingAngle={3}>
                      {turData.map((_,i) => <Cell key={i} fill={PIE_C[i%PIE_C.length]}/>)}
                    </Pie>
                    <Tooltip contentStyle={{ background:C.card, border:`1px solid ${C.b}`, borderRadius:8, fontSize:12 }}/>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display:"flex", flexWrap:"wrap", gap:"5px 12px", justifyContent:"center", marginTop:6 }}>
                  {turData.map((d,i) => (
                    <span key={i} style={{ fontSize:10, color:C.muted, display:"flex", alignItems:"center", gap:4 }}>
                      <span style={{ width:7, height:7, borderRadius:2, background:PIE_C[i%PIE_C.length], flexShrink:0 }}/>
                      {d.name} <b style={{ color:C.txt }}>{d.value}</b>
                    </span>
                  ))}
                </div>
              </>}
        </Kart>
      </div>
      {/* Alt satır */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <Kart>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <h3 style={{ fontSize:12, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:".6px" }}>🔥 Son Eşleşmeler</h3>
            <Btn sz="xs" v="ghost" onClick={() => goTo("eslesmeler")}>Tümü →</Btn>
          </div>
          {topE.length === 0
            ? <p style={{ color:C.muted, fontSize:13, textAlign:"center", padding:24 }}>Eşleşme yok</p>
            : topE.map(e => {
                const t = talepler.find(x => x.id === e.talep_id);
                const p = portfoyler.find(x => x.id === e.portfoy_id);
                const pct = Math.round(e.skor * 100);
                const col = pct >= 75 ? C.green : pct >= 55 ? C.amber : C.red;
                return (
                  <div key={e.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:`1px solid ${C.b}` }}>
                    <div style={{ width:38, height:38, borderRadius:9, background:`${col}18`, display:"flex",
                      alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, color:col, flexShrink:0 }}>{pct}%</div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:11.5, fontWeight:600, marginBottom:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        🔍 {t?.bolge||"—"} · {t?.oda_sayisi||"—"} · {money(t?.butce_max_tl)}
                      </div>
                      <div style={{ fontSize:11, color:C.muted, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                        🏠 {p?.ilce||"—"}/{p?.mahalle||"—"} · {money(p?.fiyat, p?.para_birimi)}
                      </div>
                    </div>
                  </div>
                );
              })}
        </Kart>
        <Kart>
          <h3 style={{ fontSize:12, fontWeight:700, color:C.muted, marginBottom:14, textTransform:"uppercase", letterSpacing:".6px" }}>⚡ Aktiviteler</h3>
          {activities.length === 0
            ? <p style={{ color:C.muted, fontSize:13, textAlign:"center", padding:24 }}>Aktivite yok</p>
            : [...activities].reverse().slice(0, 8).map((a, i) => (
                <div key={i} style={{ display:"flex", gap:9, padding:"7px 0", borderBottom:i<7?`1px solid ${C.b}`:"none" }}>
                  <span style={{ fontSize:13, flexShrink:0 }}>{a.icon||"📌"}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:12, lineHeight:1.5 }}>{a.text}</div>
                    <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>{a.tarih}</div>
                  </div>
                </div>
              ))}
        </Kart>
      </div>
      <Kart style={{ padding:14 }}>
        <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
          <span style={{ fontSize:11, color:C.muted, fontWeight:700 }}>HIZLI:</span>
          <Btn sz="sm" onClick={() => goTo("import")} icon="📥">WA Import</Btn>
          <Btn sz="sm" v="purple" onClick={() => goTo("portfoy")} icon="🏠">Portföy Ekle</Btn>
          <Btn sz="sm" v="green"  onClick={() => goTo("talepler")} icon="🔍">Talep Ekle</Btn>
          <Btn sz="sm" v="amber"  onClick={() => goTo("pipeline")} icon="📋">Pipeline</Btn>
        </div>
      </Kart>
    </div>
  );
};

// ══════════════════════════════════════════
// SAYFA: WA IMPORT
// ══════════════════════════════════════════
const PageImport = ({ geminiKey, portfoyler, talepler, onAddP, onAddT, goTo }) => {
  const [txt, setTxt] = useState("");
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState(null);
  const [step, setStep] = useState(0);
  const fileRef = useRef();
  const logRef  = useRef();

  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [log]);
  const addLog = (m, t="info") => setLog(p => [...p, { m, t, ts: new Date().toLocaleTimeString("tr-TR") }]);

  const parse = async () => {
    if (!txt.trim()) return;
    if (!geminiKey) { addLog("❌ Gemini API anahtarı girilmedi → Ayarlar sayfasına gidin", "error"); return; }
    setLoading(true); setLog([]); setStep(0);
    const msgs = parseWA(txt);
    addLog(`${msgs.length} geçerli WhatsApp mesajı tespit edildi`);
    const BATCH = 10; const groups = [];
    for (let i = 0; i < msgs.length; i += BATCH) groups.push(msgs.slice(i, i+BATCH));
    const all = [];
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i];
      addLog(`Batch ${i+1}/${groups.length}: ${g.length} mesaj Gemini'ye gönderiliyor…`);
      try {
        const blok = g.map(m => `[${m.z} | ${m.g}]: ${m.m}`).join("\n\n");
        const res = await geminiParse(blok, geminiKey);
        addLog(`  → ${res.length} kayıt çıkarıldı`, "success");
        all.push(...res);
      } catch(e) { addLog(`  ✕ ${e.message}`, "error"); }
      if (i < groups.length-1) await new Promise(r => setTimeout(r, 900));
    }
    const newP = [], newT = [];
    for (const k of all) {
      if (k.tip === "portfoy") {
        const fiyat = k.Fiyat_Orijinal ?? null;
        const id = uid(k.Ilce, k.Oda_Sayisi, fiyat, k.Iletisim);
        if (!portfoyler.some(p => p.id === id))
          newP.push({ id, tarih:now(), islem_tipi:k.Islem_Tipi??"Satılık", tur:k.Tur??"Daire",
            ilce:k.Ilce??"", mahalle:k.Mahalle??"", oda_sayisi:k.Oda_Sayisi??"",
            fiyat, fiyat_tl:fiyat, para_birimi:k.Para_Birimi??"TL",
            ozellikler:k.Ozellikler??"", iletisim:k.Iletisim??"", kaynak:"WA Import" });
      } else if (k.tip === "talep") {
        const butce = k.Butce_Max ?? null;
        const id = uid(k.Bolge, k.Oda_Sayisi, butce, k.Iletisim);
        if (!talepler.some(t => t.id === id))
          newT.push({ id, tarih:now(), islem_tipi:k.Islem_Tipi??"Satılık", tur:k.Tur??"Daire",
            bolge:k.Bolge??"", oda_sayisi:k.Oda_Sayisi??"",
            butce_max_tl:butce, para_birimi:k.Para_Birimi??"TL",
            iletisim:k.Iletisim??"", eslesme_durumu:"Bekliyor", kaynak:"WA Import" });
      }
    }
    addLog(`✅ Önizleme: ${newP.length} yeni portföy + ${newT.length} yeni talep`, "success");
    setPreview({ p:newP, t:newT }); setStep(1); setLoading(false);
  };

  const confirm = () => {
    if (!preview) return;
    preview.p.forEach(p => onAddP(p, true));
    preview.t.forEach(t => onAddT(t, true));
    addLog(`✅ ${preview.p.length} portföy + ${preview.t.length} talep eklendi`, "success");
    setStep(2); setPreview(null);
  };

  const ORNEK = `[29.01.2024, 14:30] Ahmet Emlak: Lara çıktı! 2+1 sıfır asansörlü. 4.800.000 TL. 05321234567
[29.01.2024, 14:32] Mehmet: Müşterim Güzeloba veya Fener'de satılık 2+1 arıyor. Max 5M nakit. 05412345678
[29.01.2024, 14:45] Selin GYO: Şirinyalı prestij 3+1 140m² havuzlu site. 6.500.000 TL. 05531234567
[29.01.2024, 15:10] Zeynep: Müvekkilim Konyaaltı/Hurma villa 3+1 ya da 4+1 max 10M arıyor. 05711234567
[29.01.2024, 15:20] Can: Lara 2+1 teraslı 5M. 05821234567`;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <Kart>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
          <div>
            <h3 style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>📥 WhatsApp Sohbet İmport</h3>
            <p style={{ fontSize:12, color:C.muted }}>
              Gemini 1.5 Flash (ücretsiz) ile otomatik ayrıştırma → Google Sheets'e kayıt
            </p>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn sz="sm" v="ghost" onClick={() => fileRef.current.click()} icon="📁">Dosya</Btn>
            {txt && <Btn sz="sm" v="danger" onClick={() => { setTxt(""); setLog([]); setStep(0); setPreview(null); }}>Temizle</Btn>}
            <input ref={fileRef} type="file" accept=".txt" style={{ display:"none" }}
              onChange={e => { const f=e.target.files[0]; if(!f) return; const r=new FileReader(); r.onload=ev=>setTxt(ev.target.result); r.readAsText(f,"UTF-8"); e.target.value=""; }}/>
          </div>
        </div>
        <textarea value={txt} onChange={e => setTxt(e.target.value)} rows={9} className="mono"
          placeholder={"WhatsApp sohbet metnini buraya yapıştırın…\n\n[29.01.2024, 14:30] Ahmet: Lara 2+1 satılık 4.8M TL asansörlü 05321234567\n[29.01.2024, 14:32] Mehmet: Fener bölgesinde 2+1 arıyor max 5M 05412345678"}/>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:12 }}>
          <span style={{ fontSize:12, color:C.muted }}>
            {txt ? `~${parseWA(txt).length} mesaj tespit edildi` : "Metin bekleniyor"}
            {" · "}<span style={{ color:geminiKey ? C.greenL : C.redL }}>{geminiKey ? "Gemini ✓" : "Anahtar Yok ✕"}</span>
          </span>
          <div style={{ display:"flex", gap:8 }}>
            <Btn sz="sm" v="ghost" onClick={() => setTxt(ORNEK)}>📋 Örnek Yükle</Btn>
            <Btn onClick={parse} loading={loading} disabled={!txt.trim() || loading}>🤖 Gemini ile Analiz Et</Btn>
          </div>
        </div>
      </Kart>

      {log.length > 0 && (
        <Kart style={{ padding:14 }}>
          <div ref={logRef} className="mono" style={{ maxHeight:190, overflow:"auto", display:"flex", flexDirection:"column", gap:3 }}>
            {log.map((l, i) => (
              <div key={i} style={{ display:"flex", gap:10, fontSize:11.5, padding:"3px 0",
                borderBottom:`1px solid ${C.b}`,
                color: l.t==="success"?C.greenL : l.t==="error"?C.redL : C.muted }}>
                <span style={{ opacity:.5, flexShrink:0 }}>{l.ts}</span>
                <span>{l.m}</span>
              </div>
            ))}
          </div>
        </Kart>
      )}

      {preview && step===1 && (
        <Kart>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
            <h3 style={{ fontSize:14, fontWeight:700 }}>📋 Önizleme — Eklenecek Kayıtlar</h3>
            <div style={{ display:"flex", gap:8 }}>
              <Bdg c="blue">{preview.p.length} Portföy</Bdg>
              <Bdg c="purple">{preview.t.length} Talep</Bdg>
            </div>
          </div>
          {[...preview.p.map(x=>({...x,_tip:"portfoy"})), ...preview.t.map(x=>({...x,_tip:"talep"}))].map((item,i) => (
            <div key={i} style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 0", borderBottom:`1px solid ${C.b}` }}>
              <Bdg c={item._tip==="portfoy"?"blue":"purple"}>{item._tip==="portfoy"?"🏠":"🔍"}</Bdg>
              <div style={{ flex:1, fontSize:12 }}>
                {item._tip==="portfoy"
                  ? <span><b>{item.islem_tipi}</b> {item.tur} · {item.ilce}/{item.mahalle} · {item.oda_sayisi} · <b style={{color:C.green}}>{money(item.fiyat,item.para_birimi)}</b> · {item.iletisim}</span>
                  : <span><b>{item.islem_tipi}</b> {item.tur} · {item.bolge} · {item.oda_sayisi} · max <b style={{color:C.amber}}>{money(item.butce_max_tl)}</b> · {item.iletisim}</span>}
              </div>
            </div>
          ))}
          {(preview.p.length + preview.t.length) === 0 &&
            <p style={{ color:C.muted, fontSize:13, padding:"14px 0" }}>Yeni eklenecek kayıt yok (zaten mevcut).</p>}
          <div style={{ display:"flex", gap:10, marginTop:14 }}>
            <Btn v="green" onClick={confirm} disabled={preview.p.length+preview.t.length===0}>
              ✓ Onayla & Google Sheets'e Kaydet
            </Btn>
            <Btn v="ghost" onClick={() => { setStep(0); setPreview(null); }}>İptal</Btn>
          </div>
        </Kart>
      )}

      {step===2 && (
        <Kart style={{ textAlign:"center", padding:50 }}>
          <div style={{ fontSize:52, marginBottom:14 }}>✅</div>
          <h3 style={{ fontWeight:700, marginBottom:8 }}>Import Tamamlandı!</h3>
          <p style={{ color:C.muted, fontSize:13, marginBottom:20 }}>
            Veriler Google Sheets'e kaydedildi ve eşleştirme motoru çalıştırıldı.
          </p>
          <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
            <Btn onClick={() => goTo("eslesmeler")}>🤝 Eşleşmeleri Gör</Btn>
            <Btn v="ghost" onClick={() => { setStep(0); setTxt(""); setLog([]); }}>Yeni Import</Btn>
          </div>
        </Kart>
      )}
    </div>
  );
};

// ══════════════════════════════════════════
// SAYFA: PORTFÖY
// ══════════════════════════════════════════
const BLANK_P = { islem_tipi:"Satılık", tur:"Daire", ilce:"", mahalle:"", oda_sayisi:"", fiyat:"", para_birimi:"TL", ozellikler:"", iletisim:"", notlar:"" };

const PagePortfoy = ({ portfoyler, eslesmeler, onAdd, onDelete, toast }) => {
  const [q, setQ]         = useState("");
  const [flt, setFlt]     = useState({ islem:"", tur:"" });
  const [modal, setModal] = useState(null);
  const [form, setForm]   = useState(BLANK_P);
  const set = k => e => setForm(p => ({ ...p, [k]:e.target.value }));

  const filtered = useMemo(() => {
    let d = [...portfoyler];
    if (q) d = d.filter(p => trN(`${p.ilce} ${p.mahalle} ${p.oda_sayisi} ${p.ozellikler} ${p.iletisim}`).includes(trN(q)));
    if (flt.islem) d = d.filter(p => p.islem_tipi === flt.islem);
    if (flt.tur)   d = d.filter(p => p.tur === flt.tur);
    return d.sort((a,b) => (b.tarih||"").localeCompare(a.tarih||""));
  }, [portfoyler, q, flt]);

  const submit = () => {
    const fiyat = parseNum(form.fiyat);
    const id = uid(form.ilce, form.oda_sayisi, fiyat, form.iletisim);
    if (portfoyler.some(p => p.id === id)) { toast("Bu portföy zaten mevcut","warning"); return; }
    onAdd({ ...form, id, tarih:now(), fiyat, fiyat_tl:fiyat });
    setModal(null); setForm(BLANK_P);
  };

  const IR = i => ({ Satılık:"blue", Kiralık:"green", Devren:"amber" })[i] ?? "gray";

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", alignItems:"center" }}>
        <input placeholder="🔎 İlçe, semt, özellik…" value={q} onChange={e=>setQ(e.target.value)} style={{ maxWidth:240 }}/>
        <select value={flt.islem} onChange={e=>setFlt(p=>({...p,islem:e.target.value}))} style={{ width:130 }}>
          <option value="">Tüm İşlemler</option><option>Satılık</option><option>Kiralık</option><option>Devren</option>
        </select>
        <select value={flt.tur} onChange={e=>setFlt(p=>({...p,tur:e.target.value}))} style={{ width:120 }}>
          <option value="">Tüm Türler</option><option>Daire</option><option>Villa</option><option>Arsa</option><option>Ticari</option>
        </select>
        <span style={{ marginLeft:"auto", fontSize:12, color:C.muted }}>{filtered.length} ilan</span>
        <Btn sz="sm" v="purple" onClick={() => setModal("add")}>+ Portföy Ekle</Btn>
      </div>

      {filtered.length === 0
        ? <Kart><p style={{ color:C.muted, textAlign:"center", padding:60 }}>Portföy bulunamadı</p></Kart>
        : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(295px,1fr))", gap:14 }}>
            {filtered.map(p => {
              const ec = eslesmeler.filter(e => e.portfoy_id === p.id).length;
              return (
                <Kart key={p.id} onClick={() => setModal(p)} style={{ position:"relative", cursor:"pointer" }}>
                  <div style={{ position:"absolute", top:12, right:12, display:"flex", gap:5, flexWrap:"wrap", maxWidth:"65%", justifyContent:"flex-end" }}>
                    <Bdg c={IR(p.islem_tipi)} xs>{p.islem_tipi}</Bdg>
                    <Bdg c="gray" xs>{p.tur}</Bdg>
                    {ec > 0 && <Bdg c="teal" xs>🤝{ec}</Bdg>}
                  </div>
                  <div style={{ marginTop:20, fontSize:15, fontWeight:700, marginBottom:3 }}>{p.ilce||"—"} / {p.mahalle||"—"}</div>
                  <div style={{ fontSize:22, fontWeight:800, color:C.blueL, marginBottom:10 }}>{money(p.fiyat, p.para_birimi)}</div>
                  {p.oda_sayisi && <Bdg c="purple" xs>🛏 {p.oda_sayisi}</Bdg>}
                  {p.ozellikler && <p style={{ fontSize:11, color:C.muted, marginTop:8, lineHeight:1.6 }}>✨ {p.ozellikler}</p>}
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:10, paddingTop:10, borderTop:`1px solid ${C.b}` }}>
                    <span style={{ fontSize:11, color:C.muted }}>📞 {p.iletisim||"—"}</span>
                    <button onClick={e => { e.stopPropagation(); onDelete(p.id); toast("Silindi","info"); }}
                      style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:14 }}>🗑</button>
                  </div>
                </Kart>
              );
            })}
          </div>}

      {modal==="add" && (
        <Modal title="🏠 Yeni Portföy Ekle" onClose={() => { setModal(null); setForm(BLANK_P); }}>
          <FG>
            <F label="İşlem Tipi"><select value={form.islem_tipi} onChange={set("islem_tipi")}><option>Satılık</option><option>Kiralık</option><option>Devren</option></select></F>
            <F label="Emlak Türü"><select value={form.tur} onChange={set("tur")}><option>Daire</option><option>Villa</option><option>Arsa</option><option>Ticari</option></select></F>
            <F label="İlçe"><input placeholder="Muratpaşa" value={form.ilce} onChange={set("ilce")}/></F>
            <F label="Semt/Mahalle"><input placeholder="Lara" value={form.mahalle} onChange={set("mahalle")}/></F>
            <F label="Oda Sayısı"><input placeholder="2+1" value={form.oda_sayisi} onChange={set("oda_sayisi")}/></F>
            <F label="Fiyat"><input placeholder="4800000" value={form.fiyat} onChange={set("fiyat")}/></F>
            <F label="Para Birimi"><select value={form.para_birimi} onChange={set("para_birimi")}><option>TL</option><option>EUR</option><option>USD</option></select></F>
            <F label="İletişim"><input placeholder="05321234567" value={form.iletisim} onChange={set("iletisim")}/></F>
          </FG>
          <F label="Özellikler"><input placeholder="Asansörlü, teraslı, yeni bina" value={form.ozellikler} onChange={set("ozellikler")} style={{ marginTop:14 }}/></F>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:18 }}>
            <Btn v="ghost" onClick={() => { setModal(null); setForm(BLANK_P); }}>İptal</Btn>
            <Btn v="purple" onClick={submit}>✓ Ekle</Btn>
          </div>
        </Modal>
      )}

      {modal && modal !== "add" && (
        <Modal title={`🏠 ${modal.ilce} / ${modal.mahalle||"—"}`} onClose={() => setModal(null)}>
          <FG>
            <div><div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>İŞLEM</div><Bdg c={IR(modal.islem_tipi)}>{modal.islem_tipi}</Bdg></div>
            <div><div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>FİYAT</div><div style={{ fontSize:20, fontWeight:800, color:C.blueL }}>{money(modal.fiyat, modal.para_birimi)}</div></div>
            <div><div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>ODA</div><div style={{ fontWeight:600 }}>{modal.oda_sayisi||"—"}</div></div>
            <div><div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>İLETİŞİM</div><div style={{ fontWeight:600 }}>{modal.iletisim||"—"}</div></div>
          </FG>
          {modal.ozellikler && <div style={{ marginTop:14 }}><div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>ÖZELLİKLER</div><div style={{ color:C.dim }}>{modal.ozellikler}</div></div>}
          <Div label={`${eslesmeler.filter(e=>e.portfoy_id===modal.id).length} Eşleşme`}/>
          {eslesmeler.filter(e=>e.portfoy_id===modal.id).sort((a,b)=>b.skor-a.skor).map(e => (
            <div key={e.id} style={{ display:"flex", gap:10, padding:"8px 0", borderBottom:`1px solid ${C.b}`, alignItems:"center" }}>
              <Ring skor={e.skor}/>
              <div style={{ flex:1, fontSize:12, color:C.muted }}>{e.talep_ozet||"—"}</div>
            </div>
          ))}
          {eslesmeler.filter(e=>e.portfoy_id===modal.id).length===0 && <p style={{ color:C.muted, fontSize:13 }}>Eşleşme yok</p>}
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:14 }}>
            <Btn v="danger" sz="sm" onClick={() => { onDelete(modal.id); setModal(null); toast("Silindi","info"); }}>🗑 Sil</Btn>
            <Btn v="ghost" onClick={() => setModal(null)}>Kapat</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ══════════════════════════════════════════
// SAYFA: TALEPLER
// ══════════════════════════════════════════
const BLANK_T = { islem_tipi:"Satılık", tur:"Daire", bolge:"", oda_sayisi:"", butce_max_tl:"", para_birimi:"TL", iletisim:"", oncelik:"Normal" };

const PageTalepler = ({ talepler, eslesmeler, portfoyler, onAdd, onDelete, onUpdate, toast, geminiKey }) => {
  const [q, setQ]         = useState("");
  const [modal, setModal] = useState(null);
  const [detay, setDetay] = useState(null);
  const [form, setForm]   = useState(BLANK_T);
  const [msg, setMsg]     = useState("");
  const [msgLoad, setML]  = useState(false);
  const set = k => e => setForm(p => ({ ...p, [k]:e.target.value }));

  const filtered = useMemo(() =>
    [...talepler]
      .filter(t => !q || trN(`${t.bolge} ${t.oda_sayisi} ${t.iletisim}`).includes(trN(q)))
      .sort((a,b) => {
        const po = { Yüksek:0, Normal:1, Düşük:2 };
        return (po[a.oncelik]??1) - (po[b.oncelik]??1);
      }),
    [talepler, q]);

  const submit = () => {
    const butce = parseNum(form.butce_max_tl);
    const id = uid(form.bolge, form.oda_sayisi, butce, form.iletisim);
    if (talepler.some(t => t.id === id)) { toast("Bu talep zaten mevcut","warning"); return; }
    onAdd({ ...form, id, tarih:now(), butce_max_tl:butce, eslesme_durumu:"Bekliyor" });
    setModal(null); setForm(BLANK_T);
  };

  const genMsg = async (talep, portfoy) => {
    if (!geminiKey) { toast("Gemini anahtarı gerekli","error"); return; }
    setML(true); setMsg("");
    try { setMsg(await geminiMsg(talep, portfoy, geminiKey)); }
    catch(e) { toast(e.message,"error"); }
    setML(false);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", gap:10, alignItems:"center" }}>
        <input placeholder="🔎 Bölge, iletişim…" value={q} onChange={e=>setQ(e.target.value)} style={{ maxWidth:260 }}/>
        <span style={{ marginLeft:"auto", fontSize:12, color:C.muted }}>{filtered.length} talep</span>
        <Btn sz="sm" v="green" onClick={() => setModal("add")}>+ Talep Ekle</Btn>
      </div>

      {filtered.length === 0
        ? <Kart><p style={{ color:C.muted, textAlign:"center", padding:60 }}>Talep bulunamadı</p></Kart>
        : filtered.map(t => {
            const tE  = eslesmeler.filter(e => e.talep_id === t.id).sort((a,b) => b.skor - a.skor);
            const best = tE[0];
            const dRenk = { Bekliyor:"amber", Eşleşti:"green", Kapalı:"gray" }[t.eslesme_durumu] ?? "gray";
            return (
              <Kart key={t.id} onClick={() => { setDetay(t); setMsg(""); }} style={{ cursor:"pointer" }}>
                <div style={{ display:"flex", gap:14, alignItems:"flex-start" }}>
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", gap:7, marginBottom:7, flexWrap:"wrap" }}>
                      <Bdg c="green">{t.islem_tipi}</Bdg>
                      <Bdg c="gray">{t.tur}</Bdg>
                      <Bdg c={dRenk}>{t.eslesme_durumu}</Bdg>
                      {t.oncelik==="Yüksek" && <Bdg c="red">🔥 Yüksek</Bdg>}
                    </div>
                    <div style={{ fontSize:16, fontWeight:700, marginBottom:5 }}>📍 {t.bolge||"Belirtilmemiş"}</div>
                    <div style={{ fontSize:12, color:C.muted, display:"flex", gap:14, flexWrap:"wrap" }}>
                      {t.oda_sayisi && <span>🛏 {t.oda_sayisi}</span>}
                      {t.butce_max_tl && <span>💰 {money(t.butce_max_tl)}</span>}
                      {t.iletisim && <span>📞 {t.iletisim}</span>}
                      <span style={{ fontSize:11 }}>🕐 {t.tarih}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:7 }}>
                    {best && <Ring skor={best.skor}/>}
                    <div style={{ display:"flex", gap:5 }}>
                      {tE.length>0 && <Btn sz="xs" onClick={e => { e.stopPropagation(); setDetay(t); setMsg(""); }}>🤝 {tE.length}</Btn>}
                      <button onClick={e => { e.stopPropagation(); onDelete(t.id); toast("Silindi","info"); }}
                        style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:13 }}>🗑</button>
                    </div>
                  </div>
                </div>
              </Kart>
            );
          })}

      {modal==="add" && (
        <Modal title="🔍 Yeni Talep Ekle" onClose={() => { setModal(null); setForm(BLANK_T); }}>
          <FG>
            <F label="İşlem Tipi"><select value={form.islem_tipi} onChange={set("islem_tipi")}><option>Satılık</option><option>Kiralık</option></select></F>
            <F label="Tür"><select value={form.tur} onChange={set("tur")}><option>Daire</option><option>Villa</option><option>Arsa</option><option>Ticari</option></select></F>
            <F label="Öncelik"><select value={form.oncelik} onChange={set("oncelik")}><option>Yüksek</option><option>Normal</option><option>Düşük</option></select></F>
            <F label="Oda Sayısı"><input placeholder="2+1" value={form.oda_sayisi} onChange={set("oda_sayisi")}/></F>
          </FG>
          <F label="Aranan Bölge (virgülle birden fazla)"><input placeholder="Lara, Fener, Güzeloba" value={form.bolge} onChange={set("bolge")} style={{ marginTop:14 }}/></F>
          <FG>
            <F label="Max Bütçe (TL)"><input placeholder="5000000" value={form.butce_max_tl} onChange={set("butce_max_tl")} style={{ marginTop:14 }}/></F>
            <F label="İletişim"><input placeholder="05321234567" value={form.iletisim} onChange={set("iletisim")} style={{ marginTop:14 }}/></F>
          </FG>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:18 }}>
            <Btn v="ghost" onClick={() => { setModal(null); setForm(BLANK_T); }}>İptal</Btn>
            <Btn v="green" onClick={submit}>✓ Ekle</Btn>
          </div>
        </Modal>
      )}

      {detay && (
        <Modal title={`🔍 ${detay.bolge||"Talep Detayı"}`} onClose={() => { setDetay(null); setMsg(""); }} width={700}>
          <FG cols={3}>
            <div><div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>İŞLEM</div><Bdg c="green">{detay.islem_tipi}</Bdg></div>
            <div><div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>ODA</div><div style={{ fontWeight:700 }}>{detay.oda_sayisi||"—"}</div></div>
            <div><div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>BÜTÇE</div><div style={{ fontWeight:700, color:C.amberL }}>{money(detay.butce_max_tl)}</div></div>
          </FG>
          <Div label={`${eslesmeler.filter(e=>e.talep_id===detay.id).length} Eşleşme`}/>
          {eslesmeler.filter(e=>e.talep_id===detay.id).sort((a,b)=>b.skor-a.skor).map(e => {
            const p = portfoyler.find(x => x.id === e.portfoy_id);
            return (
              <div key={e.id} style={{ background:"#070F1E", borderRadius:10, border:`1px solid ${C.b}`, padding:14, marginBottom:10 }}>
                <div style={{ display:"flex", gap:12, alignItems:"center", marginBottom:10 }}>
                  <Ring skor={e.skor}/>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:3 }}>{p?.ilce||"—"} / {p?.mahalle||"—"}</div>
                    <div style={{ fontSize:12, color:C.muted }}>{p?.oda_sayisi||"—"} · {money(p?.fiyat, p?.para_birimi)} · {p?.iletisim||"—"}</div>
                  </div>
                  <Btn sz="xs" v="teal" onClick={() => genMsg(detay, p)} loading={msgLoad}>✉ Mesaj</Btn>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:4 }}>
                  <SBar label="Bütçe"    score={e.b} w={40}/>
                  <SBar label="Lokasyon" score={e.l} w={30}/>
                  <SBar label="Oda"      score={e.o} w={20}/>
                  <SBar label="Tür"      score={e.t} w={10}/>
                </div>
                {msg && (
                  <div style={{ marginTop:10, background:"#0A1828", borderRadius:8, padding:12, border:`1px solid ${C.b}` }}>
                    <div style={{ fontSize:11, color:C.tealL, fontWeight:700, marginBottom:6 }}>✉ Gemini Tanışma Mesajı</div>
                    <p style={{ fontSize:13, lineHeight:1.7 }}>{msg}</p>
                    <Btn sz="xs" v="ghost" style={{ marginTop:8 }}
                      onClick={() => { navigator.clipboard?.writeText(msg); toast("Kopyalandı","success"); }}>📋 Kopyala</Btn>
                  </div>
                )}
              </div>
            );
          })}
          {eslesmeler.filter(e=>e.talep_id===detay.id).length===0 && <p style={{ color:C.muted, fontSize:13 }}>Eşleşme bulunamadı</p>}
          <div style={{ display:"flex", gap:8, marginTop:14 }}>
            <Btn sz="sm" v="ghost" onClick={() => { onUpdate(detay.id,{eslesme_durumu:"Kapalı"}); toast("Kapatıldı","info"); setDetay(null); setMsg(""); }}>✓ Kapat</Btn>
            <Btn v="ghost" onClick={() => { setDetay(null); setMsg(""); }}>Kapat</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ══════════════════════════════════════════
// SAYFA: EŞLEŞMELER
// ══════════════════════════════════════════
const PageEslesmeler = ({ eslesmeler, talepler, portfoyler, geminiKey, toast }) => {
  const [minS, setMinS] = useState(0);
  const [q, setQ]       = useState("");
  const [msgs, setMsgs] = useState({});
  const [ldId, setLdId] = useState(null);

  const sorted = [...eslesmeler]
    .filter(e => e.skor >= minS/100)
    .filter(e => {
      if (!q) return true;
      const t = talepler.find(x=>x.id===e.talep_id);
      const p = portfoyler.find(x=>x.id===e.portfoy_id);
      return trN(`${t?.bolge} ${p?.ilce} ${p?.mahalle}`).includes(trN(q));
    })
    .sort((a,b) => b.skor - a.skor);

  const gen = async e => {
    const t = talepler.find(x=>x.id===e.talep_id);
    const p = portfoyler.find(x=>x.id===e.portfoy_id);
    if (!t||!p||!geminiKey) { toast("Gemini anahtarı gerekli","error"); return; }
    setLdId(e.id);
    try { const m = await geminiMsg(t, p, geminiKey); setMsgs(s=>({...s,[e.id]:m})); }
    catch(err) { toast(err.message,"error"); }
    setLdId(null);
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
        <input placeholder="🔎 Bölge, ilçe…" value={q} onChange={e=>setQ(e.target.value)} style={{ maxWidth:220 }}/>
        <div style={{ display:"flex", alignItems:"center", gap:10, background:C.card, border:`1px solid ${C.b}`, borderRadius:8, padding:"6px 12px" }}>
          <span style={{ fontSize:12, color:C.muted }}>Min Skor:</span>
          <input type="range" min={0} max={90} step={5} value={minS} onChange={e=>setMinS(+e.target.value)}
            style={{ width:90, accentColor:C.blue, background:"transparent", border:"none", cursor:"pointer" }}/>
          <span style={{ fontSize:12, fontWeight:700, color:C.blueL, minWidth:28 }}>{minS}%</span>
        </div>
        <div style={{ marginLeft:"auto", display:"flex", gap:7 }}>
          <Bdg c="green">75%+: {sorted.filter(e=>e.skor>=.75).length}</Bdg>
          <Bdg c="amber">55-75%: {sorted.filter(e=>e.skor>=.55&&e.skor<.75).length}</Bdg>
          <Bdg c="red">55%-: {sorted.filter(e=>e.skor<.55).length}</Bdg>
        </div>
      </div>

      {sorted.length === 0
        ? <Kart><p style={{ color:C.muted, textAlign:"center", padding:60 }}>Eşleşme bulunamadı</p></Kart>
        : sorted.map((e, idx) => {
            const t   = talepler.find(x=>x.id===e.talep_id);
            const p   = portfoyler.find(x=>x.id===e.portfoy_id);
            const gmsg = msgs[e.id];
            return (
              <Kart key={e.id} style={{ animation:`fadeUp .3s ease ${idx*.03}s both` }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 110px 1fr", gap:14, alignItems:"center", marginBottom:12 }}>
                  <div style={{ background:"#070F1E", borderRadius:9, padding:12, borderLeft:`3px solid ${C.purple}` }}>
                    <div style={{ fontSize:10, fontWeight:700, color:C.purpleL, textTransform:"uppercase", letterSpacing:".8px", marginBottom:7 }}>🔍 TALEBİ</div>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:5 }}>📍 {t?.bolge||"—"}</div>
                    <div style={{ fontSize:11, color:C.muted }}>🛏 {t?.oda_sayisi||"—"}</div>
                    <div style={{ fontSize:11, color:C.muted }}>💰 {money(t?.butce_max_tl)}</div>
                    {t?.iletisim && <div style={{ fontSize:11, color:C.muted }}>📞 {t.iletisim}</div>}
                  </div>
                  <div style={{ textAlign:"center", display:"flex", flexDirection:"column", alignItems:"center", gap:5 }}>
                    <Ring skor={e.skor}/>
                    <div style={{ fontSize:10, color:C.muted }}>{e.tarih}</div>
                  </div>
                  <div style={{ background:"#070F1E", borderRadius:9, padding:12, borderLeft:`3px solid ${C.blue}` }}>
                    <div style={{ fontSize:10, fontWeight:700, color:C.blueL, textTransform:"uppercase", letterSpacing:".8px", marginBottom:7 }}>🏠 PORTFÖY</div>
                    <div style={{ fontWeight:700, fontSize:13, marginBottom:5 }}>{p?.ilce||"—"} / {p?.mahalle||"—"}</div>
                    <div style={{ fontSize:11, color:C.muted }}>🛏 {p?.oda_sayisi||"—"}</div>
                    <div style={{ fontSize:11, color:C.muted }}>💰 {money(p?.fiyat, p?.para_birimi)}</div>
                    {p?.iletisim && <div style={{ fontSize:11, color:C.muted }}>📞 {p.iletisim}</div>}
                    {p?.ozellikler && <div style={{ fontSize:10, color:C.muted, marginTop:4 }}>✨ {p.ozellikler}</div>}
                  </div>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 18px", marginBottom:10 }}>
                  <SBar label="💰 Bütçe"    score={e.b} w={40}/>
                  <SBar label="📍 Lokasyon" score={e.l} w={30}/>
                  <SBar label="🛏 Oda"      score={e.o} w={20}/>
                  <SBar label="✨ Tür"      score={e.t} w={10}/>
                </div>
                {gmsg && (
                  <div style={{ background:"#070F1E", borderRadius:8, padding:"10px 12px", marginBottom:8, border:`1px solid ${C.b}` }}>
                    <div style={{ fontSize:11, color:C.tealL, fontWeight:700, marginBottom:5 }}>✉ Gemini Tanışma Mesajı</div>
                    <p style={{ fontSize:13, lineHeight:1.7 }}>{gmsg}</p>
                    <Btn sz="xs" v="ghost" style={{ marginTop:7 }}
                      onClick={() => { navigator.clipboard?.writeText(gmsg); toast("Kopyalandı","success"); }}>📋 Kopyala</Btn>
                  </div>
                )}
                <div style={{ display:"flex", justifyContent:"flex-end" }}>
                  <Btn sz="xs" v="teal" onClick={() => gen(e)} loading={ldId===e.id}>{gmsg?"✉ Yenile":"✉ Mesaj Oluştur"}</Btn>
                </div>
              </Kart>
            );
          })}
    </div>
  );
};

// ══════════════════════════════════════════
// SAYFA: PIPELINE (KANBAN)
// ══════════════════════════════════════════
const STAGES = [
  { id:"lead",     label:"🎯 Lead",      color:C.blue   },
  { id:"contact",  label:"📞 İletişim",  color:C.purple },
  { id:"showing",  label:"🏠 Gezi",      color:C.amber  },
  { id:"offer",    label:"📝 Teklif",    color:"#F97316"},
  { id:"contract", label:"✍️ Sözleşme", color:C.teal   },
  { id:"closed",   label:"✅ Kapandı",  color:C.green  },
];

const BLANK_D = { baslik:"", musteri:"", deger:"", para_birimi:"TL", stage:"lead", notlar:"" };

const PagePipeline = ({ deals, onAdd, onUpdate, onDelete, toast }) => {
  const [modal, setModal] = useState(false);
  const [detay, setDetay] = useState(null);
  const [form, setForm]   = useState(BLANK_D);
  const set = k => e => setForm(p => ({ ...p, [k]:e.target.value }));

  const submit = () => {
    if (!form.baslik) { toast("Başlık gerekli","warning"); return; }
    const deger = parseNum(form.deger);
    onAdd({ ...form, id:uid(form.baslik, form.musteri, Date.now()), tarih:now(), deger });
    setModal(false); setForm(BLANK_D);
  };

  const move = (d, dir) => {
    const idx = STAGES.findIndex(s => s.id === d.stage);
    const ni  = idx + dir;
    if (ni < 0 || ni >= STAGES.length) return;
    onUpdate(d.id, { stage: STAGES[ni].id });
  };

  const totalV = s => deals.filter(d=>d.stage===s).reduce((acc,d)=>acc+(d.deger||0),0);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ display:"flex", gap:10 }}>
          <Bdg c="blue">{deals.length} Deal</Bdg>
          <Bdg c="green">Kapanan: {money(totalV("closed"))}</Bdg>
        </div>
        <Btn sz="sm" v="amber" onClick={() => setModal(true)}>+ Deal Ekle</Btn>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:`repeat(${STAGES.length},1fr)`, gap:10, overflowX:"auto" }}>
        {STAGES.map(stage => {
          const sd = deals.filter(d => d.stage === stage.id);
          return (
            <div key={stage.id} style={{ minWidth:160 }}>
              <div style={{ padding:"9px 11px", borderRadius:"8px 8px 0 0", background:`${stage.color}15`, border:`1px solid ${stage.color}28`, borderBottom:"none" }}>
                <div style={{ fontSize:12, fontWeight:700, color:stage.color }}>{stage.label}</div>
                <div style={{ fontSize:10, color:C.muted, marginTop:1 }}>{sd.length} · {money(totalV(stage.id))}</div>
              </div>
              <div style={{ background:"#060C16", border:`1px solid ${stage.color}18`, borderRadius:"0 0 8px 8px", minHeight:200, padding:7, display:"flex", flexDirection:"column", gap:7 }}>
                {sd.map(d => (
                  <div key={d.id} style={{ background:C.card, border:`1px solid ${C.b}`, borderRadius:8, padding:11, cursor:"pointer" }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=`${stage.color}60`}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=C.b}
                    onClick={() => setDetay(d)}>
                    <div style={{ fontSize:12, fontWeight:700, marginBottom:3, lineHeight:1.4 }}>{d.baslik}</div>
                    {d.musteri && <div style={{ fontSize:11, color:C.muted, marginBottom:3 }}>👤 {d.musteri}</div>}
                    {d.deger   && <div style={{ fontSize:12, fontWeight:700, color:C.amberL }}>{money(d.deger, d.para_birimi)}</div>}
                    <div style={{ display:"flex", gap:4, marginTop:7 }}>
                      <button onClick={e=>{e.stopPropagation();move(d,-1);}} disabled={stage.id===STAGES[0].id}
                        style={{ background:"none", border:`1px solid ${C.b}`, color:C.muted, borderRadius:4, padding:"2px 6px", fontSize:10, cursor:"pointer", opacity:stage.id===STAGES[0].id?.3:1 }}>←</button>
                      <button onClick={e=>{e.stopPropagation();move(d,1);}} disabled={stage.id===STAGES[STAGES.length-1].id}
                        style={{ background:"none", border:`1px solid ${C.b}`, color:C.muted, borderRadius:4, padding:"2px 6px", fontSize:10, cursor:"pointer", opacity:stage.id===STAGES[STAGES.length-1].id?.3:1 }}>→</button>
                      <button onClick={e=>{e.stopPropagation();onDelete(d.id);toast("Silindi","info");}}
                        style={{ background:"none", border:"none", color:C.red, cursor:"pointer", fontSize:11, marginLeft:"auto" }}>🗑</button>
                    </div>
                  </div>
                ))}
                {sd.length===0 && <div style={{ textAlign:"center", padding:"22px 0", fontSize:12, color:C.muted, opacity:.4 }}>Boş</div>}
              </div>
            </div>
          );
        })}
      </div>

      {modal && (
        <Modal title="📋 Yeni Deal" onClose={() => { setModal(false); setForm(BLANK_D); }}>
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <F label="Başlık"><input value={form.baslik} onChange={set("baslik")} placeholder="Lara 2+1 satış"/></F>
            <FG>
              <F label="Müşteri"><input value={form.musteri} onChange={set("musteri")} placeholder="Ahmet Yılmaz"/></F>
              <F label="Deal Değeri (TL)"><input value={form.deger} onChange={set("deger")} placeholder="4800000"/></F>
            </FG>
            <F label="Aşama"><select value={form.stage} onChange={set("stage")}>{STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></F>
            <F label="Notlar"><textarea value={form.notlar} onChange={set("notlar")} rows={2} placeholder="Notlar…"/></F>
          </div>
          <div style={{ display:"flex", justifyContent:"flex-end", gap:8, marginTop:16 }}>
            <Btn v="ghost" onClick={() => { setModal(false); setForm(BLANK_D); }}>İptal</Btn>
            <Btn v="amber" onClick={submit}>✓ Deal Ekle</Btn>
          </div>
        </Modal>
      )}

      {detay && (
        <Modal title={`📋 ${detay.baslik}`} onClose={() => setDetay(null)}>
          <FG>
            <div><div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>AŞAMA</div><Bdg c="blue">{STAGES.find(s=>s.id===detay.stage)?.label||detay.stage}</Bdg></div>
            <div><div style={{ fontSize:11, color:C.muted, marginBottom:4 }}>DEĞER</div><div style={{ fontWeight:700, fontSize:16, color:C.amberL }}>{money(detay.deger, detay.para_birimi)}</div></div>
          </FG>
          <div style={{ marginTop:16, marginBottom:14 }}>
            <div style={{ fontSize:11, color:C.muted, marginBottom:8, fontWeight:700 }}>AŞAMA DEĞİŞTİR:</div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {STAGES.map(s => (
                <button key={s.id}
                  onClick={() => { onUpdate(detay.id,{stage:s.id}); setDetay(d=>({...d,stage:s.id})); toast("Güncellendi","info"); }}
                  style={{ background:detay.stage===s.id?`${s.color}22`:"transparent", border:`1px solid ${detay.stage===s.id?s.color:C.b}`,
                    color:detay.stage===s.id?s.color:C.muted, borderRadius:6, padding:"5px 11px", fontSize:11, fontWeight:600, cursor:"pointer" }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <Btn sz="sm" v="danger" onClick={() => { onDelete(detay.id); setDetay(null); toast("Silindi","info"); }}>🗑 Sil</Btn>
            <Btn sz="sm" v="ghost" onClick={() => setDetay(null)}>Kapat</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ══════════════════════════════════════════
// SAYFA: HESAPLAYICI
// ══════════════════════════════════════════
const PageHesap = () => {
  const [tab, setTab] = useState("komisyon");
  const [sat, setSat] = useState({ fiyat:"", oran:"2", vergi:"20" });
  const [kira, setKira] = useState({ aylik:"", ay:"12", kAy:"1" });
  const [kur, setKur]   = useState({ miktar:"", birim:"EUR", kurEUR:"38.5", kurUSD:"35.5" });

  const K = () => { const f=parseNum(sat.fiyat)||0,o=+sat.oran||0,v=+sat.vergi||0,br=f*(o/100),kd=br*(v/100); return {f,br,kd,net:br+kd}; };
  const KR= () => { const a=parseNum(kira.aylik)||0,ay=+kira.ay||0,ka=+kira.kAy||1,k=a*ka; return {y:a*ay,k,kd:k*.2,net:k+(k*.2)}; };
  const KU= () => { const m=parseNum(kur.miktar)||0,k=kur.birim==="EUR"?+kur.kurEUR||38.5:+kur.kurUSD||35.5; return {tl:m*k,k,b:kur.birim}; };
  const kk=K(),kr=KR(),ku=KU();

  const RR = ({label,value,big,hl}) => (
    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:`1px solid ${C.b}` }}>
      <span style={{ fontSize:big?14:13,color:big?C.txt:C.muted,fontWeight:big?600:400 }}>{label}</span>
      <span style={{ fontSize:big?20:14,fontWeight:big?800:600,color:hl?C.green:C.txt }}>{value}</span>
    </div>
  );

  const TB = (id,l) => (
    <button onClick={() => setTab(id)} style={{ padding:"8px 16px",borderRadius:8,border:"none",fontSize:13,fontWeight:tab===id?700:400,background:tab===id?"rgba(59,130,246,.12)":"transparent",color:tab===id?"#60A5FA":C.muted,cursor:"pointer" }}>{l}</button>
  );

  return (
    <div style={{ display:"flex",flexDirection:"column",gap:14,maxWidth:620 }}>
      <Kart style={{ padding:"8px 8px 0" }}><div style={{ display:"flex",gap:4 }}>{TB("komisyon","🏠 Satış")}{TB("kira","🔑 Kira")}{TB("kur","💱 Döviz")}</div></Kart>
      {tab==="komisyon" && <>
        <Kart>
          <h3 style={{ fontSize:14,fontWeight:700,marginBottom:14 }}>🏠 Satış Komisyon Hesaplayıcı</h3>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <F label="Satış Fiyatı (TL)"><input value={sat.fiyat} onChange={e=>setSat(p=>({...p,fiyat:e.target.value}))} placeholder="5000000"/></F>
            <FG><F label="Komisyon Oranı (%)"><input type="number" value={sat.oran} onChange={e=>setSat(p=>({...p,oran:e.target.value}))} min={0} max={10} step={.5}/></F>
            <F label="KDV Oranı (%)"><input type="number" value={sat.vergi} onChange={e=>setSat(p=>({...p,vergi:e.target.value}))} min={0} max={40}/></F></FG>
          </div>
        </Kart>
        <Kart>
          <h3 style={{ fontSize:13,fontWeight:700,marginBottom:4 }}>Hesaplama Sonucu</h3>
          <RR label="Satış Fiyatı" value={money(kk.f)}/>
          <RR label={`Brüt Komisyon (%${sat.oran})`} value={money(kk.br)}/>
          <RR label={`KDV (%${sat.vergi})`} value={money(kk.kd)}/>
          <RR label="Net Tahsilat" value={money(kk.net)} big hl/>
          <div style={{ marginTop:14,padding:12,background:"#07101E",borderRadius:8,border:`1px solid ${C.b}` }}>
            <div style={{ fontSize:11,color:C.muted,marginBottom:4 }}>Her iki taraftan toplam komisyon:</div>
            <div style={{ fontSize:24,fontWeight:800,color:C.green }}>{money(kk.net*2)}</div>
          </div>
        </Kart>
      </>}
      {tab==="kira" && <>
        <Kart>
          <h3 style={{ fontSize:14,fontWeight:700,marginBottom:14 }}>🔑 Kira Komisyon Hesaplayıcı</h3>
          <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
            <F label="Aylık Kira (TL)"><input value={kira.aylik} onChange={e=>setKira(p=>({...p,aylik:e.target.value}))} placeholder="25000"/></F>
            <FG><F label="Kira Süresi (ay)"><input type="number" value={kira.ay} onChange={e=>setKira(p=>({...p,ay:e.target.value}))}/></F>
            <F label="Komisyon (kaç aylık)" hint="Standart: 1 aylık"><input type="number" value={kira.kAy} onChange={e=>setKira(p=>({...p,kAy:e.target.value}))} step={.5}/></F></FG>
          </div>
        </Kart>
        <Kart>
          <RR label="Yıllık Kira" value={money(kr.y)}/>
          <RR label={`Komisyon (${kira.kAy} aylık)`} value={money(kr.k)}/>
          <RR label="KDV (%20)" value={money(kr.kd)}/>
          <RR label="Net Tahsilat" value={money(kr.net)} big hl/>
        </Kart>
      </>}
      {tab==="kur" && <>
        <Kart>
          <h3 style={{ fontSize:14,fontWeight:700,marginBottom:14 }}>💱 Döviz / TL Çevirici</h3>
          <FG><F label="Miktar"><input value={kur.miktar} onChange={e=>setKur(p=>({...p,miktar:e.target.value}))} placeholder="100000"/></F>
          <F label="Para Birimi"><select value={kur.birim} onChange={e=>setKur(p=>({...p,birim:e.target.value}))}><option>EUR</option><option>USD</option></select></F>
          <F label="EUR/TL" hint="Manuel girin"><input type="number" value={kur.kurEUR} onChange={e=>setKur(p=>({...p,kurEUR:e.target.value}))} step={.1}/></F>
          <F label="USD/TL" hint="Manuel girin"><input type="number" value={kur.kurUSD} onChange={e=>setKur(p=>({...p,kurUSD:e.target.value}))} step={.1}/></F></FG>
        </Kart>
        <Kart>
          <RR label={`${kur.miktar||"0"} ${ku.b}`} value={`= ${money(ku.tl)} ₺`} big hl/>
          <RR label="Kur" value={`1 ${ku.b} = ${ku.k} ₺`}/>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12 }}>
            {[1_000_000,2_000_000,3_000_000,5_000_000].map(v => (
              <div key={v} style={{ background:"#07101E",borderRadius:8,padding:"10px 12px",textAlign:"center",border:`1px solid ${C.b}` }}>
                <div style={{ fontSize:11,color:C.muted,marginBottom:2 }}>{money(v,ku.b)}</div>
                <div style={{ fontSize:14,fontWeight:700,color:C.blueL }}>{money(v*ku.k)}</div>
              </div>
            ))}
          </div>
        </Kart>
      </>}
    </div>
  );
};

// ══════════════════════════════════════════
// SAYFA: AYARLAR
// ══════════════════════════════════════════
const PageAyarlar = ({ config, onSave, portfoyler, talepler, eslesmeler, deals, onClear, toast, onTestSheets, onTestGemini, sheetsOk, geminiOk, syncing }) => {
  const [form, setForm]     = useState({ appsScriptUrl:config.appsScriptUrl||"", geminiKey:config.geminiKey||"" });
  const [showKey, setShow]  = useState(false);
  const [testing, setTest]  = useState("");

  const test = async svc => {
    setTest(svc);
    if (svc==="sheets") {
      const ok = await onTestSheets(form.appsScriptUrl);
      toast(ok?"Google Sheets bağlantısı başarılı ✓":"Sheets bağlantı hatası — URL'yi kontrol edin", ok?"success":"error");
    }
    if (svc==="gemini") {
      const ok = await onTestGemini(form.geminiKey);
      toast(ok?"Gemini API bağlantısı başarılı ✓":"Gemini API hatası — Anahtarı kontrol edin", ok?"success":"error");
    }
    setTest("");
  };

  const exportData = () => {
    const d = JSON.stringify({ portfoyler, talepler, eslesmeler, deals, exportDate:now() }, null, 2);
    const b = new Blob([d],{type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = `ai_deal_match_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    toast("Dışa aktarıldı","success");
  };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth:640 }}>

      {/* Google Sheets */}
      <Kart>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
          <h3 style={{ fontSize:14, fontWeight:700 }}>🔗 Google Apps Script URL</h3>
          <ApiStatus sheetsOk={sheetsOk} geminiOk={geminiOk} syncing={syncing}/>
        </div>
        <p style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
          Google Sheets veritabanı bağlantısı. Apps Script'i deploy ettikten sonra URL'yi buraya girin.
        </p>
        <input value={form.appsScriptUrl}
          onChange={e => setForm(p => ({...p, appsScriptUrl:e.target.value}))}
          placeholder="https://script.google.com/macros/s/AKfy…/exec"
          className="mono" style={{ marginBottom:10, fontSize:12 }}/>
        <div style={{ fontSize:11, color:C.muted, marginBottom:10, lineHeight:1.6 }}>
          📋 Deploy: <b>script.google.com</b> → Projeyi aç → Dağıt → Web uygulaması olarak dağıt → Herkes erişebilir
        </div>
        <Btn sz="sm" v="ghost" onClick={() => test("sheets")} loading={testing==="sheets"}>🔌 Bağlantıyı Test Et</Btn>
      </Kart>

      {/* Gemini */}
      <Kart>
        <h3 style={{ fontSize:14, fontWeight:700, marginBottom:4 }}>🤖 Google Gemini API Anahtarı</h3>
        <p style={{ fontSize:12, color:C.muted, marginBottom:12 }}>
          Ücretsiz! →{" "}
          <a href="https://aistudio.google.com/app/apikey" target="_blank"
            style={{ color:C.blue }}>aistudio.google.com/app/apikey</a>
          {" "}→ "Get API Key" → Kopyala
          <br/>Model: <b>gemini-1.5-flash</b> — günde 1500 istek ücretsiz
        </p>
        <div style={{ display:"flex", gap:8, marginBottom:10 }}>
          <input type={showKey?"text":"password"} value={form.geminiKey}
            onChange={e => setForm(p => ({...p, geminiKey:e.target.value}))}
            placeholder="AIzaSy…" className="mono" style={{ flex:1, fontSize:12 }}/>
          <button onClick={() => setShow(v=>!v)}
            style={{ background:C.elev, border:`1px solid ${C.b}`, color:C.muted, borderRadius:8, padding:"9px 11px", cursor:"pointer", fontSize:13 }}>
            {showKey?"🙈":"👁"}
          </button>
        </div>
        <Btn sz="sm" v="ghost" onClick={() => test("gemini")} loading={testing==="gemini"}>🔌 Gemini'yi Test Et</Btn>
      </Kart>

      {/* Kaydet */}
      <Kart style={{ padding:14 }}>
        <Btn full onClick={() => { onSave(form); toast("Ayarlar kaydedildi ✓","success"); }}>
          💾 Tüm Ayarları Kaydet
        </Btn>
      </Kart>

      {/* Veri */}
      <Kart>
        <h3 style={{ fontSize:14, fontWeight:700, marginBottom:14 }}>🗄️ Veri Yönetimi</h3>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:14 }}>
          {[
            { l:"Portföy",  v:portfoyler.length,  c:C.blue   },
            { l:"Talep",    v:talepler.length,    c:C.purple },
            { l:"Eşleşme", v:eslesmeler.length,  c:C.green  },
            { l:"Deal",     v:deals.length,       c:C.amber  },
          ].map(s => (
            <div key={s.l} style={{ background:"#07101E", borderRadius:9, padding:"12px 14px", textAlign:"center", border:`1px solid ${C.b}` }}>
              <div style={{ fontSize:26, fontWeight:800, color:s.c }}>{s.v}</div>
              <div style={{ fontSize:11, color:C.muted }}>{s.l}</div>
            </div>
          ))}
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <Btn v="outline" sz="sm" onClick={exportData}>📤 JSON Dışa Aktar</Btn>
          <Btn v="danger" sz="sm" onClick={() => { if(!confirm("TÜM VERİLER SİLİNECEK?")) return; onClear(); toast("Veriler temizlendi","warning"); }}>🗑 Tüm Verileri Sil</Btn>
        </div>
      </Kart>

      {/* Hakkında */}
      <Kart style={{ background:"linear-gradient(135deg,#07101E,#0A1628)" }}>
        <div style={{ display:"flex", gap:14, alignItems:"center" }}>
          <div style={{ width:46, height:46, borderRadius:12,
            background:"linear-gradient(135deg,#1D4ED8,#7C3AED)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>🏠</div>
          <div>
            <div style={{ fontWeight:800, fontSize:15, marginBottom:4 }}>AI Deal Match v3.0</div>
            <div style={{ fontSize:12, color:C.muted, lineHeight:1.8 }}>
              <b style={{color:C.blueL}}>Vercel</b> hosting (ücretsiz) ·
              <b style={{color:C.green}}> Google Sheets</b> veritabanı (ücretsiz) ·
              <b style={{color:C.amberL}}> Gemini 1.5 Flash</b> AI (ücretsiz) ·
              <b style={{color:C.purpleL}}> Apps Script</b> backend (ücretsiz)
            </div>
          </div>
        </div>
      </Kart>
    </div>
  );
};

// ══════════════════════════════════════════
// KÖKAPP
// ══════════════════════════════════════════
const NAV = [
  { id:"dashboard",   icon:"📊", label:"Dashboard"   },
  { id:"import",      icon:"📥", label:"WA Import"   },
  { id:"portfoy",     icon:"🏠", label:"Portföy"     },
  { id:"talepler",    icon:"🔍", label:"Talepler"    },
  { id:"eslesmeler",  icon:"🤝", label:"Eşleşmeler" },
  { id:"pipeline",    icon:"📋", label:"Pipeline"    },
  { id:"hesaplayici", icon:"🧮", label:"Hesaplayıcı" },
  { id:"ayarlar",     icon:"⚙️", label:"Ayarlar"    },
];

export default function App() {
  const [page, setPage]   = useState("dashboard");
  const [sideOpen, setSO] = useState(true);

  // Veri
  const [portfoyler,   setP] = useState([]);
  const [talepler,     setT] = useState([]);
  const [eslesmeler,   setE] = useState([]);
  const [deals,        setD] = useState([]);
  const [activities,   setA] = useState([]);

  // Ayarlar
  const [config, setConfig]  = useState({ appsScriptUrl:"", geminiKey:"" });
  const [sheetsOk, setSO2]   = useState(false);
  const [geminiOk, setGO]    = useState(false);
  const [syncing, setSync]   = useState(false);
  const [loaded, setLoaded]  = useState(false);

  // Toast
  const [toasts, setToasts]  = useState([]);
  const toast = useCallback((message, type="success") => {
    const id = Date.now() + Math.random();
    setToasts(p => [...p, { id, message, type }]);
  }, []);

  // ── YÜKLEME ─────────────────────────────
  useEffect(() => {
    (async () => {
      // localStorage'dan config yükle
      try {
        const savedCfg = localStorage.getItem("adm_cfg");
        if (savedCfg) {
          const cfg = JSON.parse(savedCfg);
          setConfig(cfg);
          // Google Sheets'ten veri çek
          if (cfg.appsScriptUrl) {
            setSync(true);
            try {
              const r   = await sheetsAPI(cfg.appsScriptUrl, "getAll");
              if (r?.ok && r.data) {
                if (r.data.portfoy)    setP(r.data.portfoy);
                if (r.data.talepler)   setT(r.data.talepler);
                if (r.data.eslesmeler) setE(r.data.eslesmeler);
                if (r.data.deals)      setD(r.data.deals);
                if (r.data.activities) setA(r.data.activities);
                setSO2(true);
              }
            } catch { /* silent */ }
            setSync(false);
          }
          // Gemini test
          if (cfg.geminiKey) {
            try { await geminiCall("test", cfg.geminiKey); setGO(true); }
            catch { /* silent */ }
          }
        }
      } catch { /* silent */ }

      // localStorage fallback
      const keys = ["adm_p","adm_t","adm_e","adm_d","adm_a"];
      const sets  = [setP, setT, setE, setD, setA];
      for (let i = 0; i < keys.length; i++) {
        try { const v = localStorage.getItem(keys[i]); if (v) sets[i](JSON.parse(v)); }
        catch { /* silent */ }
      }
      setLoaded(true);
    })();
  }, []);

  // ── PERSIST ─────────────────────────────
  useEffect(() => { if (loaded) localStorage.setItem("adm_p", JSON.stringify(portfoyler)); }, [portfoyler, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("adm_t", JSON.stringify(talepler));   }, [talepler,   loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("adm_e", JSON.stringify(eslesmeler)); }, [eslesmeler, loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("adm_d", JSON.stringify(deals));      }, [deals,      loaded]);
  useEffect(() => { if (loaded) localStorage.setItem("adm_a", JSON.stringify(activities)); }, [activities, loaded]);

  // ── SHEETS HELPERS ───────────────────────
  const shAdd  = useCallback((tab, row)        => sheetsAPI(config.appsScriptUrl, "addRow",     { tab, row }),     [config]);
  const shUpd  = useCallback((tab, id, patch)  => sheetsAPI(config.appsScriptUrl, "updateRow",  { tab, id, patch }),[config]);
  const shDel  = useCallback((tab, id)         => sheetsAPI(config.appsScriptUrl, "deleteRow",  { tab, id }),      [config]);
  const shDelF = useCallback((tab, f, v)       => sheetsAPI(config.appsScriptUrl, "deleteByField",{ tab, field:f, value:v }),[config]);

  // ── AKTİVİTE ────────────────────────────
  const addAct = useCallback((text, icon="📌") => {
    const e = { text, icon, tarih:now() };
    setA(p => { const n = [...p, e].slice(-60); return n; });
  }, []);

  // ── EŞLEŞTİRME ─────────────────────────
  const doMatch = useCallback((pList, tList, eList) => {
    const newE = [];
    for (const t of tList) {
      for (const res of runMatch(t, pList)) {
        const eid = uid(t.id, res.portfoy.id);
        if (!eList.some(e => e.id === eid) && !newE.some(e => e.id === eid)) {
          newE.push({
            id:eid, talep_id:t.id, portfoy_id:res.portfoy.id,
            skor:res.skor, b:res.b, l:res.l, o:res.o, t:res.t,
            tarih:now(),
            talep_ozet:`${t.bolge||"—"} · ${t.oda_sayisi||"—"} · ${money(t.butce_max_tl)}`,
          });
        }
      }
    }
    return newE;
  }, []);

  // ── PORTFÖY CRUD ────────────────────────
  const addP = useCallback((p, silent=false) => {
    setP(prev => {
      if (prev.some(x => x.id === p.id)) return prev;
      const next = [p, ...prev];
      setT(tList => {
        setE(eList => {
          const ne = doMatch([p], tList, eList);
          if (ne.length) {
            ne.forEach(e => shAdd("eslesmeler", e));
            if (!silent) toast(`${ne.length} eşleşme bulundu! 🤝`, "success");
            return [...ne, ...eList];
          }
          return eList;
        });
        return tList;
      });
      shAdd("portfoy", p);
      if (!silent) addAct(`🏠 ${p.ilce||"—"}/${p.mahalle||"—"} ${money(p.fiyat, p.para_birimi)}`, "🏠");
      return next;
    });
  }, [doMatch, shAdd, toast, addAct]);

  const delP = useCallback(id => {
    setP(p => p.filter(x => x.id !== id));
    setE(e => e.filter(x => x.portfoy_id !== id));
    shDel("portfoy", id);
    shDelF("eslesmeler","portfoy_id",id);
  }, [shDel, shDelF]);

  // ── TALEP CRUD ──────────────────────────
  const addT = useCallback((t, silent=false) => {
    setT(prev => {
      if (prev.some(x => x.id === t.id)) return prev;
      const next = [t, ...prev];
      setP(pList => {
        setE(eList => {
          const ne = doMatch(pList, [t], eList);
          if (ne.length) {
            ne.forEach(e => shAdd("eslesmeler", e));
            if (!silent) toast(`${ne.length} eşleşme bulundu! 🤝`, "success");
            return [...ne, ...eList];
          }
          return eList;
        });
        return pList;
      });
      shAdd("talepler", t);
      if (!silent) addAct(`🔍 ${t.bolge||"—"} ${t.oda_sayisi||""} max ${money(t.butce_max_tl)}`, "🔍");
      return next;
    });
  }, [doMatch, shAdd, toast, addAct]);

  const delT = useCallback(id => {
    setT(p => p.filter(x => x.id !== id));
    setE(e => e.filter(x => x.talep_id !== id));
    shDel("talepler", id);
    shDelF("eslesmeler","talep_id",id);
  }, [shDel, shDelF]);

  const updT = useCallback((id, patch) => {
    setT(p => p.map(x => x.id===id ? {...x,...patch} : x));
    shUpd("talepler", id, patch);
  }, [shUpd]);

  // ── DEAL CRUD ────────────────────────────
  const addDeal  = useCallback(d  => { setD(p=>[d,...p]); shAdd("deals",d); addAct(`📋 ${d.baslik}`, "📋"); toast("Deal eklendi","success"); }, [shAdd, addAct, toast]);
  const updDeal  = useCallback((id,patch) => { setD(p=>p.map(x=>x.id===id?{...x,...patch}:x)); shUpd("deals",id,patch); }, [shUpd]);
  const delDeal  = useCallback(id => { setD(p=>p.filter(x=>x.id!==id)); shDel("deals",id); }, [shDel]);

  // ── DİĞER ───────────────────────────────
  const clearAll = useCallback(() => {
    setP([]); setT([]); setE([]); setD([]); setA([]);
    ["adm_p","adm_t","adm_e","adm_d","adm_a"].forEach(k => localStorage.removeItem(k));
  }, []);

  const saveConfig = useCallback(cfg => {
    setConfig(cfg);
    localStorage.setItem("adm_cfg", JSON.stringify(cfg));
  }, []);

  const testSheets = useCallback(async url => {
    try {
      const r = await sheetsAPI(url, "ping");
      const ok = r?.ok || false;
      setSO2(ok); return ok;
    } catch { setSO2(false); return false; }
  }, []);

  const testGemini = useCallback(async key => {
    try { await geminiCall("Merhaba", key); setGO(true); return true; }
    catch { setGO(false); return false; }
  }, []);

  // ── NAVİGASYON ──────────────────────────
  const highMatch = eslesmeler.filter(e => e.skor >= .75).length;
  const curNav    = NAV.find(n => n.id === page);

  const pages = {
    dashboard:   <PageDashboard portfoyler={portfoyler} talepler={talepler} eslesmeler={eslesmeler} deals={deals} activities={activities} goTo={setPage}/>,
    import:      <PageImport geminiKey={config.geminiKey} portfoyler={portfoyler} talepler={talepler} onAddP={addP} onAddT={addT} goTo={setPage}/>,
    portfoy:     <PagePortfoy portfoyler={portfoyler} eslesmeler={eslesmeler} onAdd={addP} onDelete={delP} toast={toast}/>,
    talepler:    <PageTalepler talepler={talepler} eslesmeler={eslesmeler} portfoyler={portfoyler} onAdd={addT} onDelete={delT} onUpdate={updT} toast={toast} geminiKey={config.geminiKey}/>,
    eslesmeler:  <PageEslesmeler eslesmeler={eslesmeler} talepler={talepler} portfoyler={portfoyler} geminiKey={config.geminiKey} toast={toast}/>,
    pipeline:    <PagePipeline deals={deals} onAdd={addDeal} onUpdate={updDeal} onDelete={delDeal} toast={toast}/>,
    hesaplayici: <PageHesap/>,
    ayarlar:     <PageAyarlar config={config} onSave={saveConfig} portfoyler={portfoyler} talepler={talepler} eslesmeler={eslesmeler} deals={deals} onClear={clearAll} toast={toast} onTestSheets={testSheets} onTestGemini={testGemini} sheetsOk={sheetsOk} geminiOk={geminiOk} syncing={syncing}/>,
  };

  return (
    <>
      <style>{CSS}</style>
      <div style={{ display:"flex", height:"100vh", overflow:"hidden" }}>

        {/* SIDEBAR */}
        <aside style={{ width:sideOpen?210:54, flexShrink:0, background:"#05090F",
          borderRight:`1px solid ${C.b}`, display:"flex", flexDirection:"column",
          transition:"width .2s", overflow:"hidden" }}>

          {/* Logo */}
          <div style={{ padding:"14px 12px", borderBottom:`1px solid ${C.b}`,
            display:"flex", alignItems:"center", gap:9, cursor:"pointer" }}
            onClick={() => setSO(o => !o)}>
            <div style={{ width:32, height:32, borderRadius:9,
              background:"linear-gradient(135deg,#1D4ED8,#7C3AED)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:16, flexShrink:0 }}>🏠</div>
            {sideOpen && (
              <div style={{ animation:"fadeIn .2s" }}>
                <div style={{ fontSize:13, fontWeight:800, letterSpacing:"-.3px", lineHeight:1.1 }}>AI Deal Match</div>
                <div style={{ fontSize:10, color:C.muted }}>v3.0 · Antalya GYO</div>
              </div>
            )}
          </div>

          {/* Nav */}
          <nav style={{ flex:1, padding:"8px 6px", display:"flex", flexDirection:"column", gap:2, overflow:"auto" }}>
            {NAV.map(n => (
              <button key={n.id} onClick={() => setPage(n.id)}
                style={{ display:"flex", alignItems:"center", gap:9, padding:"8px 9px",
                  borderRadius:8, border:"none", textAlign:"left",
                  background: page===n.id ? "rgba(59,130,246,.12)" : "transparent",
                  color: page===n.id ? "#60A5FA" : C.muted,
                  borderLeft: page===n.id ? `2px solid ${C.blue}` : "2px solid transparent",
                  cursor:"pointer", transition:"all .15s", width:"100%",
                  marginLeft:-2, whiteSpace:"nowrap" }}>
                <span style={{ fontSize:15, flexShrink:0 }}>{n.icon}</span>
                {sideOpen && (
                  <>
                    <span style={{ fontSize:12.5, fontWeight:page===n.id?600:400, flex:1, animation:"fadeIn .2s" }}>{n.label}</span>
                    {n.id==="eslesmeler" && highMatch>0 && (
                      <span style={{ background:C.red, color:"#fff", borderRadius:10,
                        padding:"1px 6px", fontSize:10, fontWeight:700 }}>{highMatch}</span>
                    )}
                  </>
                )}
              </button>
            ))}
          </nav>

          {/* Alt istatistik */}
          {sideOpen && (
            <div style={{ padding:"10px 12px", borderTop:`1px solid ${C.b}`, display:"flex", gap:7 }}>
              {[
                { v:portfoyler.length,  c:C.blue,   l:"P" },
                { v:talepler.filter(t=>t.eslesme_durumu==="Bekliyor").length, c:C.purple, l:"T" },
                { v:eslesmeler.length,  c:C.green,  l:"E" },
              ].map((s,i) => (
                <div key={i} style={{ flex:1, textAlign:"center", background:`${s.c}10`, borderRadius:5, padding:"4px 0" }}>
                  <div style={{ fontWeight:800, color:s.c, fontSize:13 }}>{s.v}</div>
                  <div style={{ color:C.muted, fontSize:9 }}>{s.l}</div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* MAIN */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* Header */}
          <header style={{ height:50, borderBottom:`1px solid ${C.b}`, display:"flex",
            alignItems:"center", gap:14, padding:"0 18px", background:"#05090F", flexShrink:0 }}>
            <div style={{ flex:1, display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:17 }}>{curNav?.icon}</span>
              <h1 style={{ fontSize:15, fontWeight:700 }}>{curNav?.label}</h1>
              {!config.appsScriptUrl && page!=="ayarlar" && (
                <button onClick={() => setPage("ayarlar")}
                  style={{ background:"rgba(245,158,11,.1)", border:"1px solid rgba(245,158,11,.25)",
                    color:C.amberL, borderRadius:6, padding:"3px 9px", fontSize:11, cursor:"pointer", fontWeight:600 }}>
                  ⚙ Sheets URL Ekle
                </button>
              )}
              {syncing && (
                <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, color:C.muted }}>
                  <span style={{ width:6, height:6, borderRadius:"50%", background:C.blue, animation:"pulse 1s infinite" }}/>
                  Sheets ile eşitleniyor…
                </div>
              )}
            </div>
            <div style={{ display:"flex", gap:6 }}>
              {[
                { v:portfoyler.length, c:C.blue,   l:"🏠" },
                { v:talepler.filter(t=>t.eslesme_durumu==="Bekliyor").length, c:C.purple, l:"🔍" },
                { v:eslesmeler.length, c:C.green,  l:"🤝" },
              ].map((s,i) => (
                <div key={i} style={{ background:`${s.c}12`, border:`1px solid ${s.c}22`,
                  borderRadius:5, padding:"3px 7px", fontSize:11, color:s.c, fontWeight:700 }}>
                  {s.l} {s.v}
                </div>
              ))}
            </div>
            <ApiStatus sheetsOk={sheetsOk} geminiOk={geminiOk} syncing={syncing}/>
          </header>

          {/* İçerik */}
          <main style={{ flex:1, overflow:"auto", padding:18 }}>
            <div key={page} style={{ animation:"fadeUp .25s ease", maxWidth:1360 }}>
              {pages[page] ?? <div style={{ color:C.muted, textAlign:"center", padding:80 }}>Sayfa bulunamadı</div>}
            </div>
          </main>
        </div>
      </div>

      {/* Toast stack */}
      <div style={{ position:"fixed", bottom:24, right:24, zIndex:9999, display:"flex", flexDirection:"column", gap:8 }}>
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type}
            onClose={() => setToasts(p => p.filter(x => x.id !== t.id))}/>
        ))}
      </div>
    </>
  );
}
