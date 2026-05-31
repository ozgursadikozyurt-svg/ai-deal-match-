import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

// ═══════════════════════════════════════════════════════════════════
// CONFIG — Buraya kendi değerlerinizi yazın
// ═══════════════════════════════════════════════════════════════════
const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || "";
const GEMINI_API_KEY  = import.meta.env.VITE_GEMINI_KEY || "";

// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════
const trNorm = (s="") => s.toLowerCase().replace(/ğ/g,"g").replace(/ü/g,"u").replace(/ş/g,"s").replace(/ı/g,"i").replace(/ö/g,"o").replace(/ç/g,"c").trim();
const uid = (...a) => { let h=2166136261; for(const s of a.map(x=>String(x??"").toLowerCase().trim()).join("|")) { h^=s.charCodeAt(0); h=Math.imul(h,16777619); } return (h>>>0).toString(16).slice(0,12); };
const fmt = (n,b="TL") => { if(!n&&n!==0)return"—"; const s={TL:"₺",EUR:"€",USD:"$"}[b]??b; return n>=1e6?`${(n/1e6).toFixed(2)}M ${s}`:n>=1000?`${Math.round(n/1000)}K ${s}`:`${n.toLocaleString("tr-TR")} ${s}`; };
const stamp = () => new Date().toLocaleString("tr-TR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});

// ═══════════════════════════════════════════════════════════════════
// GOOGLE SHEETS API
// ═══════════════════════════════════════════════════════════════════
const api = async (action, payload={}) => {
  if (!APPS_SCRIPT_URL) throw new Error("Apps Script URL girilmedi. Ayarlar sayfasını kontrol edin.");
  const url = `${APPS_SCRIPT_URL}?action=${action}`;
  const r = await fetch(url, {
    method: "POST",
    body: JSON.stringify({ action, ...payload }),
    redirect: "follow",
  });
  const text = await r.text();
  try { return JSON.parse(text); }
  catch { throw new Error("API yanıt hatası: " + text.slice(0,200)); }
};

// ═══════════════════════════════════════════════════════════════════
// GEMINI API (ücretsiz: gemini-1.5-flash)
// ═══════════════════════════════════════════════════════════════════
const callGemini = async (prompt, userApiKey="") => {
  const key = userApiKey || GEMINI_API_KEY;
  if (!key) throw new Error("Gemini API anahtarı girilmedi.");
  const r = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4000 },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
        ],
      }),
    }
  );
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0,150)}`);
  const d = await r.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
};

const PARSE_PROMPT = `Sen bir Antalya gayrimenkul uzmanısın. WhatsApp mesajlarını analiz edip SADECE geçerli JSON Array döndürürsün. Markdown veya açıklama YAZMA.

PORTFÖY (ilan sahibi → tip:"portfoy"):
{"tip":"portfoy","Islem_Tipi":"Satılık"|"Kiralık"|"Devren","Tur":"Daire"|"Villa"|"Arsa"|"Ticari","Ilce":string|null,"Mahalle":string|null,"Oda_Sayisi":string|null,"Fiyat_Orijinal":number|null,"Para_Birimi":"TL"|"EUR"|"USD","Ozellikler":string|null,"Iletisim":string|null}

TALEBİ (alıcı/kiracı arıyor → tip:"talep"):
{"tip":"talep","Islem_Tipi":"Satılık"|"Kiralık","Tur":"Daire"|"Villa"|"Arsa"|"Ticari","Bolge":string|null,"Oda_Sayisi":string|null,"Butce_Max":number|null,"Para_Birimi":"TL"|"EUR"|"USD","Iletisim":string|null}

KURALLAR: Sadece rakam (4 milyon→4000000). Bilinmeyenler null. Selamlama/link atla. Çoklu ilan ayrı obje.`;

const aiParse = async (text, key) => {
  const raw = await callGemini(PARSE_PROMPT + "\n\nAnaliz et:\n\n" + text, key);
  const cleaned = raw.replace(/^```(?:json)?\s*/m,"").replace(/\s*```$/m,"").trim();
  try { const p = JSON.parse(cleaned); return Array.isArray(p) ? p : [p]; }
  catch { const m = cleaned.match(/\[[\s\S]*\]/); return m ? JSON.parse(m[0]) : []; }
};

// ═══════════════════════════════════════════════════════════════════
// MATCHING ENGINE
// ═══════════════════════════════════════════════════════════════════
const W = { butce:0.40, lokasyon:0.30, oda:0.20, tip:0.10 };
const sBudget=(m,p)=>{ if(!m||!p)return .5; const r=p/m; if(r<=.7)return .65; if(r<=1)return 1-(1-r)*.25; if(r<=1.1)return 1-((r-1)/.1)*.55; return Math.max(0,.45-(r-1.1)*2); };
const sLoc=(b="",il="",mh="")=>{ if(!b)return .25; const bn=trNorm(b),iln=trNorm(il),mhn=trNorm(mh); if(bn===iln||bn===mhn)return 1; if(bn.split(/[,/|]/).some(p=>{const pt=p.trim();return pt&&(iln.includes(pt)||mhn.includes(pt));}))return .68; return 0; };
const sRoom=(a="",b="")=>{ const n=s=>{const m=s?.match(/(\d+)\+/);return m?+m[1]:0;}; const ta=n(a),tb=n(b); if(!ta||!tb)return .5; const d=Math.abs(ta-tb); return d===0?1:d===1?.55:d===2?.2:0; };
const sTip=(tI="",pI="",tT="",pT="")=>{ const im=!tI||!pI||trNorm(tI)===trNorm(pI); const tm=!tT||!pT||trNorm(tT)===trNorm(pT); return Math.min(1,(im?.6:0)+(tm?.4:.1)); };
const match=(talep,portfoyler,topN=5,min=.38)=>portfoyler
  .filter(p=>!(talep.islem_tipi&&p.islem_tipi&&trNorm(talep.islem_tipi)!==trNorm(p.islem_tipi)))
  .map(p=>{ const b=sBudget(talep.butce_max_tl,p.fiyat_tl??p.fiyat),l=sLoc(talep.bolge,p.ilce,p.mahalle),o=sRoom(talep.oda_sayisi,p.oda_sayisi),t=sTip(talep.islem_tipi,p.islem_tipi,talep.tur,p.tur); const total=b*W.butce+l*W.lokasyon+o*W.oda+t*W.tip; return {portfoy:p,skor:total,b,l,o,t}; })
  .filter(r=>r.skor>=min).sort((a,b)=>b.skor-a.skor).slice(0,topN);

// ═══════════════════════════════════════════════════════════════════
// WA PARSER
// ═══════════════════════════════════════════════════════════════════
const WA_JUNK=/gruba eklendi|Medya dahil|davet bağlantısıyla|kişisini ekledi|ayrıldı|grubun ayarlarını|numarasını değiştirdi|Mesaj bekleniyor|Bu mesaj silindi|uçtan uca|Güvenlik kodu/i;
const WA_LINE=/(?:\[)?(\d{1,2}[./]\d{1,2}[./]\d{2,4})[,\s]+(\d{1,2}:\d{2}(?::\d{2})?)(?:\])?\s*[-–]\s*([^:]+):\s*(.*)/;
const parseWA=txt=>{const msgs=[];let cur=null; for(const line of txt.split("\n")){const s=line.trim(); if(!s||WA_JUNK.test(s))continue; const m=WA_LINE.exec(s); if(m){if(cur&&cur.mesaj.length>8)msgs.push(cur);cur={z:`${m[1]} ${m[2]}`,g:m[3].trim(),m:m[4].trim()};} else if(cur)cur.m+=" "+s;} if(cur&&cur.mesaj?.length>8)msgs.push(cur); return msgs; };

// ═══════════════════════════════════════════════════════════════════
// CSS & PRIMITIVES
// ═══════════════════════════════════════════════════════════════════
const T={bg:"#050A14",card:"#0C1522",elev:"#101C2E",hov:"#131E30",b:"#172236",bL:"#1E2E48",blue:"#3B82F6",blueL:"#60A5FA",purple:"#8B5CF6",purpleL:"#A78BFA",green:"#10B981",greenL:"#34D399",amber:"#F59E0B",amberL:"#FCD34D",red:"#EF4444",teal:"#14B8A6",text:"#E2E8F0",muted:"#64748B",dim:"#94A3B8"};

const CSS=`
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
html,body,#root{height:100%;overflow:hidden;}
body{background:#050A14;color:#E2E8F0;font-family:'Outfit',sans-serif;}
::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:#172236;border-radius:2px;}
input,textarea,select{background:#080E1A;border:1px solid #172236;color:#E2E8F0;border-radius:8px;padding:9px 12px;font-family:inherit;font-size:13px;width:100%;transition:border-color .18s;outline:none;}
input:focus,textarea:focus,select:focus{border-color:#3B82F6;box-shadow:0 0 0 3px rgba(59,130,246,.1);}
select option{background:#0C1522;}
button{cursor:pointer;font-family:inherit;}
textarea{resize:vertical;line-height:1.6;}
.mono{font-family:'JetBrains Mono',monospace;}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
@keyframes popIn{from{opacity:0;transform:scale(.93)}to{opacity:1;transform:scale(1)}}
@keyframes slideR{from{opacity:0;transform:translateX(10px)}to{opacity:1;transform:none}}
`;

const Ring=({skor})=>{const pct=Math.round((skor??0)*100);const c=pct>=75?T.green:pct>=55?T.amber:T.red;const r=22,circ=2*Math.PI*r,dash=circ*(pct/100);return(<div style={{position:"relative",width:56,height:56,flexShrink:0}}><svg width={56} height={56} style={{transform:"rotate(-90deg)"}}><circle cx={28} cy={28} r={r} fill="none" stroke="#172236" strokeWidth={4}/><circle cx={28} cy={28} r={r} fill="none" stroke={c} strokeWidth={4} strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{transition:"stroke-dasharray .6s"}}/></svg><span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:c}}>{pct}%</span></div>);};

const SBar=({label,score,w})=>{const pct=Math.round((score??0)*100);const c=pct>=75?T.green:pct>=55?T.amber:T.red;return(<div style={{marginBottom:6}}><div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}><span style={{color:T.muted}}>{label}<span style={{opacity:.5}}> ×{w}</span></span><span style={{color:c,fontWeight:700}}>{pct}%</span></div><div style={{height:4,background:"#101C2E",borderRadius:2,overflow:"hidden"}}><div style={{height:"100%",width:`${pct}%`,background:`linear-gradient(90deg,${c}80,${c})`,borderRadius:2,transition:"width .5s"}}/></div></div>);};

const Bdg=({children,c="blue",xs})=>{const M={blue:{bg:"rgba(59,130,246,.1)",txt:"#60A5FA",br:"rgba(59,130,246,.2)"},purple:{bg:"rgba(139,92,246,.1)",txt:"#A78BFA",br:"rgba(139,92,246,.2)"},green:{bg:"rgba(16,185,129,.1)",txt:"#34D399",br:"rgba(16,185,129,.2)"},amber:{bg:"rgba(245,158,11,.1)",txt:"#FCD34D",br:"rgba(245,158,11,.2)"},red:{bg:"rgba(239,68,68,.1)",txt:"#FCA5A5",br:"rgba(239,68,68,.2)"},gray:{bg:"rgba(100,116,139,.08)",txt:"#94A3B8",br:"rgba(100,116,139,.2)"},teal:{bg:"rgba(20,184,166,.1)",txt:"#2DD4BF",br:"rgba(20,184,166,.2)"}};const m=M[c]??M.gray;return <span style={{background:m.bg,color:m.txt,border:`1px solid ${m.br}`,borderRadius:20,padding:xs?"1px 7px":"3px 10px",fontSize:xs?10:11,fontWeight:600,whiteSpace:"nowrap",display:"inline-block"}}>{children}</span>;};

const Card=({children,style={},onClick})=>{const[h,sH]=useState(false);return <div onClick={onClick} onMouseEnter={()=>onClick&&sH(true)} onMouseLeave={()=>sH(false)} style={{background:h?T.hov:T.card,border:`1px solid ${h?T.bL:T.b}`,borderRadius:12,padding:20,transition:"all .18s",cursor:onClick?"pointer":"default",animation:"fadeUp .3s ease",...style}}>{children}</div>;};

const Btn=({children,onClick,v="primary",sz="md",disabled,loading,style={},icon,full})=>{const[h,sH]=useState(false);const BG={primary:{bg:h?"#2563EB":"linear-gradient(135deg,#1D4ED8,#3B82F6)",c:"#fff",b:"none"},purple:{bg:h?"#7C3AED":"linear-gradient(135deg,#6D28D9,#8B5CF6)",c:"#fff",b:"none"},green:{bg:h?"#059669":"linear-gradient(135deg,#047857,#10B981)",c:"#fff",b:"none"},amber:{bg:h?"#D97706":"linear-gradient(135deg,#B45309,#F59E0B)",c:"#fff",b:"none"},red:{bg:h?"#DC2626":"linear-gradient(135deg,#B91C1C,#EF4444)",c:"#fff",b:"none"},teal:{bg:h?"#0D9488":"linear-gradient(135deg,#0F766E,#14B8A6)",c:"#fff",b:"none"},ghost:{bg:h?"#131E30":"transparent",c:T.dim,b:`1px solid ${T.b}`},outline:{bg:h?"rgba(59,130,246,.1)":"transparent",c:"#60A5FA",b:"1px solid rgba(59,130,246,.3)"},danger:{bg:h?"rgba(239,68,68,.15)":"transparent",c:"#FCA5A5",b:"1px solid rgba(239,68,68,.25)"}};const s=BG[v]??BG.ghost;const P={xs:"3px 9px",sm:"6px 13px",md:"9px 18px",lg:"12px 26px"}[sz];const F={xs:10,sm:12,md:13,lg:14}[sz];return <button onClick={onClick} disabled={disabled||loading} onMouseEnter={()=>sH(true)} onMouseLeave={()=>sH(false)} style={{background:disabled?"#131E30":s.bg,color:disabled?"#2A3E58":s.c,border:s.b,borderRadius:8,padding:P,fontSize:F,fontWeight:600,display:"inline-flex",alignItems:"center",gap:6,transition:"all .15s",opacity:disabled?.5:1,width:full?"100%":undefined,justifyContent:full?"center":undefined,transform:h&&!disabled?"translateY(-1px)":"none",...style}}>{loading&&<span style={{width:12,height:12,border:"2px solid rgba(255,255,255,.2)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .6s linear infinite",flexShrink:0}}/>}{!loading&&icon}<span>{children}</span></button>;};

const Modal=({title,children,onClose,width=560})=>(
  <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.85)",backdropFilter:"blur(8px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={e=>e.target===e.currentTarget&&onClose()}>
    <div style={{background:T.card,border:`1px solid ${T.b}`,borderRadius:16,width:"100%",maxWidth:width,maxHeight:"90vh",overflow:"auto",animation:"popIn .2s ease"}}>
      {title&&<div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 22px",borderBottom:`1px solid ${T.b}`,position:"sticky",top:0,background:T.card,zIndex:1}}><h3 style={{fontSize:15,fontWeight:700}}>{title}</h3><button onClick={onClose} style={{background:T.elev,border:`1px solid ${T.b}`,color:T.muted,borderRadius:6,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:18,lineHeight:1}}>×</button></div>}
      <div style={{padding:22}}>{children}</div>
    </div>
  </div>
);

const Toast=({message,type="success",onClose})=>{useEffect(()=>{const t=setTimeout(onClose,4500);return()=>clearTimeout(t);},[]);const C={success:T.green,error:T.red,info:T.blue,warning:T.amber};const I={success:"✓",error:"✕",info:"ℹ",warning:"⚠"};const c=C[type];return <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,background:T.card,border:`1px solid ${c}25`,borderLeft:`3px solid ${c}`,borderRadius:10,padding:"12px 16px",minWidth:280,maxWidth:380,display:"flex",alignItems:"flex-start",gap:10,animation:"slideR .3s ease",boxShadow:"0 12px 40px rgba(0,0,0,.7)"}}><span style={{color:c,fontSize:14,fontWeight:800,flexShrink:0}}>{I[type]}</span><span style={{fontSize:13,flex:1,lineHeight:1.5}}>{message}</span><button onClick={onClose} style={{background:"none",border:"none",color:T.muted,cursor:"pointer",fontSize:16}}>×</button></div>;};

const Field=({label,hint,children})=><div style={{display:"flex",flexDirection:"column",gap:6}}>{label&&<label style={{fontSize:11,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".6px"}}>{label}</label>}{children}{hint&&<p style={{fontSize:11,color:"#2A3E58"}}>{hint}</p>}</div>;
const FGrid=({children,cols=2})=><div style={{display:"grid",gridTemplateColumns:`repeat(${cols},1fr)`,gap:14}}>{children}</div>;
const Divider=({label})=><div style={{display:"flex",alignItems:"center",gap:12,margin:"16px 0"}}><div style={{flex:1,height:1,background:T.b}}/>{label&&<span style={{fontSize:11,color:T.muted}}>{label}</span>}{label&&<div style={{flex:1,height:1,background:T.b}}/>}</div>;
const StatCard=({label,value,icon,color,sub})=><Card style={{position:"relative",overflow:"hidden"}}><div style={{position:"absolute",inset:0,background:`radial-gradient(circle at 95% 5%,${color}12,transparent 60%)`,pointerEvents:"none"}}/><div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}><span style={{fontSize:12,color:T.muted}}>{label}</span><div style={{width:36,height:36,borderRadius:10,background:`${color}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{icon}</div></div><div style={{fontSize:32,fontWeight:800,color,lineHeight:1,marginBottom:4}}>{value}</div>{sub&&<div style={{fontSize:12,color:T.muted}}>{sub}</div>}</Card>;

// ═══════════════════════════════════════════════════════════════════
// API STATUS INDICATOR
// ═══════════════════════════════════════════════════════════════════
const ApiStatus=({sheetsOk,geminiOk,syncing})=>(
  <div style={{display:"flex",gap:8,alignItems:"center"}}>
    <div style={{display:"flex",alignItems:"center",gap:5,background:T.elev,border:`1px solid ${T.b}`,borderRadius:6,padding:"4px 10px"}}>
      <span style={{width:6,height:6,borderRadius:"50%",background:sheetsOk?T.green:T.red,animation:syncing?"pulse 1s infinite":"none"}}/>
      <span style={{fontSize:11,color:sheetsOk?T.greenL:T.red}}>Sheets {sheetsOk?"✓":"✕"}</span>
    </div>
    <div style={{display:"flex",alignItems:"center",gap:5,background:T.elev,border:`1px solid ${T.b}`,borderRadius:6,padding:"4px 10px"}}>
      <span style={{width:6,height:6,borderRadius:"50%",background:geminiOk?T.green:T.amber}}/>
      <span style={{fontSize:11,color:geminiOk?T.greenL:T.amberL}}>Gemini {geminiOk?"✓":"—"}</span>
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════
// PAGE: DASHBOARD
// ═══════════════════════════════════════════════════════════════════
const PageDashboard=({portfoyler,talepler,eslesmeler,deals,activities,onNavigate})=>{
  const topE=[...eslesmeler].sort((a,b)=>b.skor-a.skor).slice(0,5);
  const openT=talepler.filter(t=>t.eslesme_durumu==="Bekliyor").length;
  const high=eslesmeler.filter(e=>e.skor>=.75).length;
  const closedVal=deals.filter(d=>d.stage==="closed").reduce((s,d)=>s+(d.deger||0),0);
  const ilceMap={};portfoyler.forEach(p=>{const k=p.ilce||"Diğer";ilceMap[k]=(ilceMap[k]||0)+1;});
  const ilceData=Object.entries(ilceMap).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([name,value])=>({name,value}));
  const turMap={};portfoyler.forEach(p=>{const k=p.tur||"Diğer";turMap[k]=(turMap[k]||0)+1;});
  const turData=Object.entries(turMap).map(([name,value])=>({name,value}));
  const COLORS=[T.blue,T.purple,T.green,T.amber,T.teal,T.red];
  return(
    <div style={{display:"flex",flexDirection:"column",gap:18}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))",gap:14}}>
        <StatCard label="Portföy" value={portfoyler.length} icon="🏠" color={T.blue} sub="toplam ilan"/>
        <StatCard label="Açık Talep" value={openT} icon="🔍" color={T.purple} sub="bekliyor"/>
        <StatCard label="Eşleşme" value={eslesmeler.length} icon="🤝" color={T.green} sub={`${high} yüksek uyum`}/>
        <StatCard label="Kapanan Değer" value={fmt(closedVal||0)} icon="💰" color={T.amber} sub="pipeline"/>
        <StatCard label="CRM" value={deals.length} icon="📋" color={T.teal} sub="aktif deal"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
        <Card style={{padding:"18px 18px 8px"}}>
          <h3 style={{fontSize:12,fontWeight:700,color:T.muted,marginBottom:14,textTransform:"uppercase",letterSpacing:".6px"}}>📍 İlçe Dağılımı</h3>
          {ilceData.length===0?<p style={{color:T.muted,fontSize:13,textAlign:"center",padding:40}}>Veri yok</p>:
          <ResponsiveContainer width="100%" height={170}><BarChart data={ilceData} margin={{left:-24,bottom:0}}>
            <CartesianGrid strokeDasharray="3 3" stroke="#172236" vertical={false}/>
            <XAxis dataKey="name" tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:T.muted,fontSize:10}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={{background:T.card,border:`1px solid ${T.b}`,borderRadius:8,fontSize:12}}/>
            <Bar dataKey="value" fill={T.blue} radius={[4,4,0,0]} name="İlan"/>
          </BarChart></ResponsiveContainer>}
        </Card>
        <Card style={{padding:"18px 18px 8px"}}>
          <h3 style={{fontSize:12,fontWeight:700,color:T.muted,marginBottom:14,textTransform:"uppercase",letterSpacing:".6px"}}>🏢 Tür</h3>
          {turData.length===0?<p style={{color:T.muted,fontSize:13,textAlign:"center",padding:40}}>Veri yok</p>:<>
          <ResponsiveContainer width="100%" height={140}><PieChart><Pie data={turData} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" paddingAngle={3}>{turData.map((_,i)=><Cell key={i} fill={COLORS[i%COLORS.length]}/>)}</Pie><Tooltip contentStyle={{background:T.card,border:`1px solid ${T.b}`,borderRadius:8,fontSize:12}}/></PieChart></ResponsiveContainer>
          <div style={{display:"flex",flexWrap:"wrap",gap:"5px 10px",justifyContent:"center",marginTop:6}}>{turData.map((d,i)=><span key={i} style={{fontSize:10,color:T.muted,display:"flex",alignItems:"center",gap:4}}><span style={{width:7,height:7,borderRadius:2,background:COLORS[i%COLORS.length],flexShrink:0}}/>{d.name} <b style={{color:T.text}}>{d.value}</b></span>)}</div></>}
        </Card>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        <Card>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><h3 style={{fontSize:12,fontWeight:700,color:T.muted,textTransform:"uppercase",letterSpacing:".6px"}}>🔥 Son Eşleşmeler</h3><Btn sz="xs" v="ghost" onClick={()=>onNavigate("eslesmeler")}>Tümü →</Btn></div>
          {topE.length===0?<p style={{color:T.muted,fontSize:13,textAlign:"center",padding:24}}>Eşleşme yok</p>:topE.map(e=>{const t=talepler.find(x=>x.id===e.talep_id);const p=portfoyler.find(x=>x.id===e.portfoy_id);const pct=Math.round(e.skor*100);const c=pct>=75?T.green:pct>=55?T.amber:T.red;return(<div key={e.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${T.b}`}}><div style={{width:38,height:38,borderRadius:9,background:`${c}18`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:800,color:c,flexShrink:0}}>{pct}%</div><div style={{flex:1,minWidth:0}}><div style={{fontSize:11.5,fontWeight:600,marginBottom:1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>🔍 {t?.bolge||"—"} · {t?.oda_sayisi||"—"} · {fmt(t?.butce_max_tl)}</div><div style={{fontSize:11,color:T.muted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>🏠 {p?.ilce||"—"}/{p?.mahalle||"—"} · {fmt(p?.fiyat,p?.para_birimi)}</div></div></div>);})}
        </Card>
        <Card>
          <h3 style={{fontSize:12,fontWeight:700,color:T.muted,marginBottom:12,textTransform:"uppercase",letterSpacing:".6px"}}>⚡ Aktiviteler</h3>
          {activities.length===0?<p style={{color:T.muted,fontSize:13,textAlign:"center",padding:24}}>Aktivite yok</p>:[...activities].reverse().slice(0,8).map((a,i)=><div key={i} style={{display:"flex",gap:9,padding:"7px 0",borderBottom:i<7?`1px solid ${T.b}`:"none"}}><span style={{fontSize:13,flexShrink:0,marginTop:1}}>{a.icon||"📌"}</span><div style={{flex:1}}><div style={{fontSize:12,lineHeight:1.5}}>{a.text}</div><div style={{fontSize:10,color:T.muted,marginTop:1}}>{a.tarih}</div></div></div>)}
        </Card>
      </div>
      <Card style={{padding:14}}><div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}><span style={{fontSize:11,color:T.muted,fontWeight:700}}>HIZLI İŞLEM:</span><Btn sz="sm" onClick={()=>onNavigate("import")} icon="📥">WA Import</Btn><Btn sz="sm" v="purple" onClick={()=>onNavigate("portfoy")} icon="🏠">Portföy</Btn><Btn sz="sm" v="green" onClick={()=>onNavigate("talepler")} icon="🔍">Talep</Btn><Btn sz="sm" v="amber" onClick={()=>onNavigate("pipeline")} icon="📋">Pipeline</Btn><Btn sz="sm" v="ghost" onClick={()=>onNavigate("analitik")} icon="📊">Analitik</Btn></div></Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// PAGE: IMPORT
// ═══════════════════════════════════════════════════════════════════
const PageImport=({geminiKey,portfoyler,talepler,onAddPortfoy,onAddTalep,onNavigate})=>{
  const[txt,setTxt]=useState("");const[log,setLog]=useState([]);const[loading,setLoading]=useState(false);const[preview,setPreview]=useState(null);const[step,setStep]=useState(0);
  const fileRef=useRef();const logRef=useRef();
  useEffect(()=>{if(logRef.current)logRef.current.scrollTop=logRef.current.scrollHeight;},[log]);
  const addLog=(m,t="info")=>setLog(p=>[...p,{m,t,ts:new Date().toLocaleTimeString("tr-TR")}]);
  const parse=async()=>{
    if(!txt.trim())return; if(!geminiKey){addLog("❌ Gemini API anahtarı girilmedi. Ayarlar → API Anahtarları","error");return;}
    setLoading(true);setLog([]);setStep(0);
    const msgs=parseWA(txt);addLog(`${msgs.length} WhatsApp mesajı tespit edildi`);
    const BATCH=10;const groups=[];for(let i=0;i<msgs.length;i+=BATCH)groups.push(msgs.slice(i,i+BATCH));
    const allRecs=[];
    for(let i=0;i<groups.length;i++){
      const g=groups[i];addLog(`Batch ${i+1}/${groups.length}: ${g.length} mesaj Gemini'ye gönderiliyor…`);
      try{const blok=g.map(m=>`[${m.z} | ${m.g}]: ${m.m}`).join("\n\n");const res=await aiParse(blok,geminiKey);addLog(`  → ${res.length} kayıt çıkarıldı`,"success");allRecs.push(...res);}
      catch(e){addLog(`  ✕ ${e.message}`,"error");}
      if(i<groups.length-1)await new Promise(r=>setTimeout(r,800));
    }
    const newP=[],newT=[];
    for(const k of allRecs){
      if(k.tip==="portfoy"){const fiyat=k.Fiyat_Orijinal??null;const id=uid(k.Ilce,k.Oda_Sayisi,fiyat,k.Iletisim);if(!portfoyler.some(p=>p.id===id))newP.push({id,tarih:stamp(),islem_tipi:k.Islem_Tipi??"Satılık",tur:k.Tur??"Daire",ilce:k.Ilce??"",mahalle:k.Mahalle??"",oda_sayisi:k.Oda_Sayisi??"",fiyat,fiyat_tl:fiyat,para_birimi:k.Para_Birimi??"TL",ozellikler:k.Ozellikler??"",iletisim:k.Iletisim??"",kaynak:"WA Import"});}
      else if(k.tip==="talep"){const butce=k.Butce_Max??null;const id=uid(k.Bolge,k.Oda_Sayisi,butce,k.Iletisim);if(!talepler.some(t=>t.id===id))newT.push({id,tarih:stamp(),islem_tipi:k.Islem_Tipi??"Satılık",tur:k.Tur??"Daire",bolge:k.Bolge??"",oda_sayisi:k.Oda_Sayisi??"",butce_max_tl:butce,para_birimi:k.Para_Birimi??"TL",iletisim:k.Iletisim??"",eslesme_durumu:"Bekliyor",kaynak:"WA Import"});}
    }
    addLog(`✅ Önizleme: ${newP.length} yeni portföy, ${newT.length} yeni talep`,"success");
    setPreview({portfoyler:newP,talepler:newT});setStep(1);setLoading(false);
  };
  const confirm_=()=>{if(!preview)return;preview.portfoyler.forEach(p=>onAddPortfoy(p,true));preview.talepler.forEach(t=>onAddTalep(t,true));addLog(`✅ ${preview.portfoyler.length} portföy + ${preview.talepler.length} talep eklendi + Google Sheets'e yazıldı`,"success");setStep(2);setPreview(null);};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div><h3 style={{fontSize:15,fontWeight:700,marginBottom:4}}>📥 WhatsApp Sohbet İmport</h3><p style={{fontSize:12,color:T.muted}}>Gemini AI ile otomatik portföy/talep ayrıştırma → Google Sheets'e kayıt</p></div>
          <div style={{display:"flex",gap:8}}><Btn sz="sm" v="ghost" onClick={()=>fileRef.current.click()} icon="📁">Dosya</Btn>{txt&&<Btn sz="sm" v="danger" onClick={()=>{setTxt("");setLog([]);setStep(0);setPreview(null);}}>Temizle</Btn>}<input ref={fileRef} type="file" accept=".txt" style={{display:"none"}} onChange={e=>{const f=e.target.files[0];if(!f)return;new FileReader().onload=ev=>setTxt(ev.target.result);const r=new FileReader();r.onload=ev=>setTxt(ev.target.result);r.readAsText(f,"UTF-8");e.target.value="";}}/>
          </div>
        </div>
        <textarea value={txt} onChange={e=>setTxt(e.target.value)} rows={9} className="mono" placeholder={"WhatsApp sohbet metnini buraya yapıştırın…\n\n[29.01.2024, 14:30] Ahmet: Lara 2+1 satılık 4.8M TL asansörlü 05321234567\n[29.01.2024, 14:32] Mehmet: Fener/Güzeloba 2+1 arıyor max 5M 05412345678"}/>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:12}}>
          <div style={{fontSize:12,color:T.muted}}>{txt?`~${parseWA(txt).length} mesaj`:""} · Gemini 1.5 Flash (ücretsiz)</div>
          <div style={{display:"flex",gap:8}}>
            <Btn sz="sm" v="ghost" onClick={()=>setTxt(`[29.01.2024, 14:30] Ahmet Emlak: Lara 2+1 sıfır asansörlü 4.800.000 TL. 05321234567\n[29.01.2024, 14:32] Mehmet: Güzeloba veya Fener 2+1 arıyor max 5M nakit. 05412345678\n[29.01.2024, 14:45] Selin GYO: Şirinyalı prestij 3+1 140m² havuzlu 6.5M. 05531234567\n[29.01.2024, 15:10] Zeynep: Konyaaltı villa 3+1 ya da 4+1 max 10M. 05711234567`)}>📋 Örnek</Btn>
            <Btn onClick={parse} loading={loading} disabled={!txt.trim()||loading}>🤖 Gemini ile Analiz Et</Btn>
          </div>
        </div>
      </Card>
      {log.length>0&&<Card style={{padding:14}}><div ref={logRef} className="mono" style={{maxHeight:180,overflow:"auto",display:"flex",flexDirection:"column",gap:3}}>{log.map((l,i)=><div key={i} style={{display:"flex",gap:10,fontSize:11.5,padding:"3px 0",borderBottom:`1px solid ${T.b}`,color:l.t==="success"?T.green:l.t==="error"?T.red:T.muted}}><span style={{opacity:.5,flexShrink:0}}>{l.ts}</span><span>{l.m}</span></div>)}</div></Card>}
      {preview&&step===1&&<Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><h3 style={{fontSize:14,fontWeight:700}}>📋 Önizleme</h3><div style={{display:"flex",gap:8}}><Bdg c="blue">{preview.portfoyler.length} Portföy</Bdg><Bdg c="purple">{preview.talepler.length} Talep</Bdg></div></div>
        {[...preview.portfoyler.map(p=>({...p,_tip:"portfoy"})),...preview.talepler.map(t=>({...t,_tip:"talep"}))].map((item,i)=>(
          <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 0",borderBottom:`1px solid ${T.b}`}}>
            <Bdg c={item._tip==="portfoy"?"blue":"purple"}>{item._tip==="portfoy"?"🏠":"🔍"}</Bdg>
            <div style={{flex:1,fontSize:12}}>{item._tip==="portfoy"?<span><b>{item.islem_tipi}</b> {item.tur} · {item.ilce}/{item.mahalle} · {item.oda_sayisi} · <b style={{color:T.green}}>{fmt(item.fiyat,item.para_birimi)}</b> · {item.iletisim}</span>:<span><b>{item.islem_tipi}</b> {item.tur} · {item.bolge} · {item.oda_sayisi} · max <b style={{color:T.amber}}>{fmt(item.butce_max_tl)}</b> · {item.iletisim}</span>}
            </div>
          </div>
        ))}
        {(preview.portfoyler.length+preview.talepler.length)===0&&<p style={{color:T.muted,fontSize:13,padding:"14px 0"}}>Yeni eklenecek kayıt yok (hepsi zaten mevcut).</p>}
        <div style={{display:"flex",gap:10,marginTop:14}}><Btn v="green" onClick={confirm_} disabled={preview.portfoyler.length+preview.talepler.length===0}>✓ Onayla — Google Sheets'e Kaydet</Btn><Btn v="ghost" onClick={()=>{setStep(0);setPreview(null);}}>İptal</Btn></div>
      </Card>}
      {step===2&&<Card style={{textAlign:"center",padding:40}}><div style={{fontSize:48,marginBottom:12}}>✅</div><h3 style={{fontWeight:700,marginBottom:8}}>Import Tamamlandı</h3><p style={{color:T.muted,fontSize:13,marginBottom:18}}>Veriler Google Sheets'e kaydedildi ve eşleştirme motoru çalıştırıldı.</p><div style={{display:"flex",gap:10,justifyContent:"center"}}><Btn onClick={()=>onNavigate("eslesmeler")}>🤝 Eşleşmeleri Gör</Btn><Btn v="ghost" onClick={()=>{setStep(0);setTxt("");setLog([]);}}>Yeni Import</Btn></div></Card>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// PAGE: PORTFÖY
// ═══════════════════════════════════════════════════════════════════
const PagePortfoy=({portfoyler,eslesmeler,onAdd,onDelete,addToast})=>{
  const[q,setQ]=useState("");const[flt,setFlt]=useState({islem:"",tur:""});const[modal,setModal]=useState(null);const[form,setForm]=useState({islem_tipi:"Satılık",tur:"Daire",ilce:"",mahalle:"",oda_sayisi:"",fiyat:"",para_birimi:"TL",ozellikler:"",iletisim:""});
  const s=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const filtered=useMemo(()=>{let d=[...portfoyler];if(q)d=d.filter(p=>trNorm(`${p.ilce} ${p.mahalle} ${p.oda_sayisi} ${p.ozellikler} ${p.iletisim}`).includes(trNorm(q)));if(flt.islem)d=d.filter(p=>p.islem_tipi===flt.islem);if(flt.tur)d=d.filter(p=>p.tur===flt.tur);return d.sort((a,b)=>(b.tarih||"").localeCompare(a.tarih||""));},[portfoyler,q,flt]);
  const submit=()=>{const fiyat=parseFloat(String(form.fiyat).replace(/[.\s]/g,"").replace(",","."))||null;const id=uid(form.ilce,form.oda_sayisi,fiyat,form.iletisim);if(portfoyler.some(p=>p.id===id)){addToast("Bu portföy zaten mevcut","warning");return;}onAdd({...form,id,tarih:stamp(),fiyat,fiyat_tl:fiyat});setModal(null);setForm({islem_tipi:"Satılık",tur:"Daire",ilce:"",mahalle:"",oda_sayisi:"",fiyat:"",para_birimi:"TL",ozellikler:"",iletisim:""});};
  const IR=i=>({Satılık:"blue",Kiralık:"green",Devren:"amber"})[i]??"gray";
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
        <input placeholder="🔎 İlçe, semt, özellik…" value={q} onChange={e=>setQ(e.target.value)} style={{maxWidth:240}}/>
        <select value={flt.islem} onChange={e=>setFlt(p=>({...p,islem:e.target.value}))} style={{width:130}}><option value="">Tüm İşlemler</option><option>Satılık</option><option>Kiralık</option><option>Devren</option></select>
        <select value={flt.tur} onChange={e=>setFlt(p=>({...p,tur:e.target.value}))} style={{width:120}}><option value="">Tüm Türler</option><option>Daire</option><option>Villa</option><option>Arsa</option><option>Ticari</option></select>
        <span style={{marginLeft:"auto",fontSize:12,color:T.muted}}>{filtered.length} ilan</span>
        <Btn sz="sm" v="purple" onClick={()=>setModal("add")}>+ Portföy Ekle</Btn>
      </div>
      {filtered.length===0?<Card><p style={{color:T.muted,textAlign:"center",padding:60}}>Portföy bulunamadı</p></Card>:
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(295px,1fr))",gap:14}}>
        {filtered.map(p=>{const ec=eslesmeler.filter(e=>e.portfoy_id===p.id).length;return(
          <Card key={p.id} onClick={()=>setModal(p)} style={{cursor:"pointer",position:"relative"}}>
            <div style={{position:"absolute",top:12,right:12,display:"flex",gap:5,flexWrap:"wrap",maxWidth:"65%",justifyContent:"flex-end"}}><Bdg c={IR(p.islem_tipi)} xs>{p.islem_tipi}</Bdg><Bdg c="gray" xs>{p.tur}</Bdg>{ec>0&&<Bdg c="teal" xs>🤝{ec}</Bdg>}</div>
            <div style={{marginTop:18,fontSize:15,fontWeight:700,marginBottom:3}}>{p.ilce||"—"} / {p.mahalle||"—"}</div>
            <div style={{fontSize:22,fontWeight:800,color:T.blueL,marginBottom:10}}>{fmt(p.fiyat,p.para_birimi)}</div>
            {p.oda_sayisi&&<Bdg c="purple" xs>🛏 {p.oda_sayisi}</Bdg>}
            {p.ozellikler&&<p style={{fontSize:11,color:T.muted,marginTop:8,lineHeight:1.6}}>✨ {p.ozellikler}</p>}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:10,paddingTop:10,borderTop:`1px solid ${T.b}`}}><span style={{fontSize:11,color:T.muted}}>📞 {p.iletisim||"—"}</span><button onClick={e=>{e.stopPropagation();onDelete(p.id);addToast("Silindi","info");}} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:14,opacity:.7}}>🗑</button></div>
          </Card>);
        })}
      </div>}
      {modal==="add"&&<Modal title="🏠 Yeni Portföy Ekle" onClose={()=>setModal(null)}>
        <FGrid><Field label="İşlem Tipi"><select value={form.islem_tipi} onChange={s("islem_tipi")}><option>Satılık</option><option>Kiralık</option><option>Devren</option></select></Field><Field label="Emlak Türü"><select value={form.tur} onChange={s("tur")}><option>Daire</option><option>Villa</option><option>Arsa</option><option>Ticari</option></select></Field><Field label="İlçe"><input placeholder="Muratpaşa" value={form.ilce} onChange={s("ilce")}/></Field><Field label="Semt/Mahalle"><input placeholder="Lara" value={form.mahalle} onChange={s("mahalle")}/></Field><Field label="Oda Sayısı"><input placeholder="2+1" value={form.oda_sayisi} onChange={s("oda_sayisi")}/></Field><Field label="Fiyat"><input placeholder="4800000" value={form.fiyat} onChange={s("fiyat")}/></Field><Field label="Para Birimi"><select value={form.para_birimi} onChange={s("para_birimi")}><option>TL</option><option>EUR</option><option>USD</option></select></Field><Field label="İletişim"><input placeholder="05321234567" value={form.iletisim} onChange={s("iletisim")}/></Field></FGrid>
        <Field label="Özellikler"><input placeholder="Asansörlü, teraslı, yeni bina" value={form.ozellikler} onChange={s("ozellikler")} style={{marginTop:14}}/></Field>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}><Btn v="ghost" onClick={()=>setModal(null)}>İptal</Btn><Btn v="purple" onClick={submit}>✓ Ekle & Sheets'e Kaydet</Btn></div>
      </Modal>}
      {modal&&modal!=="add"&&<Modal title={`🏠 ${modal.ilce} / ${modal.mahalle||"—"}`} onClose={()=>setModal(null)}>
        <FGrid><div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>İŞLEM</div><Bdg c={IR(modal.islem_tipi)}>{modal.islem_tipi}</Bdg></div><div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>FİYAT</div><div style={{fontSize:20,fontWeight:800,color:T.blueL}}>{fmt(modal.fiyat,modal.para_birimi)}</div></div><div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>ODA</div><div style={{fontWeight:600}}>{modal.oda_sayisi||"—"}</div></div><div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>İLETİŞİM</div><div style={{fontWeight:600,fontSize:13}}>{modal.iletisim||"—"}</div></div></FGrid>
        {modal.ozellikler&&<div style={{marginTop:14}}><div style={{fontSize:11,color:T.muted,marginBottom:4}}>ÖZELLİKLER</div><div style={{color:T.dim}}>{modal.ozellikler}</div></div>}
        <Divider label="Eşleşmeler"/>
        {eslesmeler.filter(e=>e.portfoy_id===modal.id).sort((a,b)=>b.skor-a.skor).map(e=><div key={e.id} style={{display:"flex",gap:10,padding:"8px 0",borderBottom:`1px solid ${T.b}`,alignItems:"center"}}><Ring skor={e.skor}/><div style={{flex:1,fontSize:12,color:T.muted}}>{e.talep_ozet||"—"}</div><span style={{fontSize:11,color:T.muted}}>{e.tarih}</span></div>)}
        {eslesmeler.filter(e=>e.portfoy_id===modal.id).length===0&&<p style={{color:T.muted,fontSize:13}}>Eşleşme bulunamadı</p>}
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}><Btn v="danger" sz="sm" onClick={()=>{onDelete(modal.id);setModal(null);addToast("Silindi","info");}}>🗑</Btn><Btn v="ghost" onClick={()=>setModal(null)}>Kapat</Btn></div>
      </Modal>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// PAGE: TALEPLER
// ═══════════════════════════════════════════════════════════════════
const PageTalepler=({talepler,eslesmeler,portfoyler,onAdd,onDelete,onUpdate,addToast,geminiKey})=>{
  const[q,setQ]=useState("");const[modal,setModal]=useState(null);const[detay,setDetay]=useState(null);const[form,setForm]=useState({islem_tipi:"Satılık",tur:"Daire",bolge:"",oda_sayisi:"",butce_max_tl:"",para_birimi:"TL",iletisim:"",oncelik:"Normal"});const[genMsg,setGenMsg]=useState("");const[msgLoad,setMsgLoad]=useState(false);
  const s=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const filtered=useMemo(()=>[...talepler].filter(t=>!q||trNorm(`${t.bolge} ${t.oda_sayisi} ${t.iletisim}`).includes(trNorm(q))).sort((a,b)=>{const po={Yüksek:0,Normal:1,Düşük:2};return(po[a.oncelik]??1)-(po[b.oncelik]??1);}), [talepler,q]);
  const submit=()=>{const butce=parseFloat(String(form.butce_max_tl).replace(/[.\s]/g,"").replace(",","."))||null;const id=uid(form.bolge,form.oda_sayisi,butce,form.iletisim);if(talepler.some(t=>t.id===id)){addToast("Bu talep zaten mevcut","warning");return;}onAdd({...form,id,tarih:stamp(),butce_max_tl:butce,eslesme_durumu:"Bekliyor"});setModal(null);setForm({islem_tipi:"Satılık",tur:"Daire",bolge:"",oda_sayisi:"",butce_max_tl:"",para_birimi:"TL",iletisim:"",oncelik:"Normal"});};
  const genMessage=async(talep,portfoy)=>{
    if(!geminiKey){addToast("Gemini anahtarı gerekli","error");return;}
    setMsgLoad(true);setGenMsg("");
    try{const msg=await callGemini(`Şu emlak eşleşmesi için Türkçe, kısa (3-4 cümle) profesyonel tanışma mesajı yaz. Müşteri ${talep.bolge||"—"}'de ${talep.oda_sayisi||""} arıyor, bütçe ${fmt(talep.butce_max_tl)}. Portföy: ${portfoy.ilce}/${portfoy.mahalle} ${portfoy.oda_sayisi} ${fmt(portfoy.fiyat,portfoy.para_birimi)}. Sadece mesajı yaz.`,geminiKey);setGenMsg(msg);}catch(e){addToast(e.message,"error");}
    setMsgLoad(false);
  };
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",gap:10,alignItems:"center"}}><input placeholder="🔎 Bölge, iletişim…" value={q} onChange={e=>setQ(e.target.value)} style={{maxWidth:260}}/><span style={{marginLeft:"auto",fontSize:12,color:T.muted}}>{filtered.length} talep</span><Btn sz="sm" v="green" onClick={()=>setModal("add")}>+ Talep Ekle</Btn></div>
      {filtered.length===0?<Card><p style={{color:T.muted,textAlign:"center",padding:60}}>Talep bulunamadı</p></Card>:filtered.map(t=>{const tE=eslesmeler.filter(e=>e.talep_id===t.id).sort((a,b)=>b.skor-a.skor);const best=tE[0];return(
        <Card key={t.id} onClick={()=>{setDetay(t);setGenMsg("");}} style={{cursor:"pointer"}}>
          <div style={{display:"flex",gap:14,alignItems:"flex-start"}}><div style={{flex:1}}><div style={{display:"flex",gap:7,marginBottom:7,flexWrap:"wrap"}}><Bdg c="green">{t.islem_tipi}</Bdg><Bdg c="gray">{t.tur}</Bdg><Bdg c={t.eslesme_durumu==="Eşleşti"?"green":"amber"}>{t.eslesme_durumu}</Bdg>{t.oncelik==="Yüksek"&&<Bdg c="red">🔥 Yüksek</Bdg>}</div><div style={{fontSize:16,fontWeight:700,marginBottom:5}}>📍 {t.bolge||"Belirtilmemiş"}</div><div style={{fontSize:12,color:T.muted,display:"flex",gap:14,flexWrap:"wrap"}}>{t.oda_sayisi&&<span>🛏 {t.oda_sayisi}</span>}{t.butce_max_tl&&<span>💰 {fmt(t.butce_max_tl)}</span>}{t.iletisim&&<span>📞 {t.iletisim}</span>}<span style={{fontSize:11}}>🕐 {t.tarih}</span></div></div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:7}}>{best&&<Ring skor={best.skor}/>}<div style={{display:"flex",gap:5}}>{tE.length>0&&<Btn sz="xs" onClick={e=>{e.stopPropagation();setDetay(t);setGenMsg("");}}>🤝 {tE.length}</Btn>}<button onClick={e=>{e.stopPropagation();onDelete(t.id);addToast("Silindi","info");}} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:13,opacity:.7}}>🗑</button></div></div>
          </div>
        </Card>);})}
      {modal==="add"&&<Modal title="🔍 Yeni Talep Ekle" onClose={()=>setModal(null)}>
        <FGrid><Field label="İşlem Tipi"><select value={form.islem_tipi} onChange={s("islem_tipi")}><option>Satılık</option><option>Kiralık</option></select></Field><Field label="Tür"><select value={form.tur} onChange={s("tur")}><option>Daire</option><option>Villa</option><option>Arsa</option><option>Ticari</option></select></Field><Field label="Öncelik"><select value={form.oncelik} onChange={s("oncelik")}><option>Yüksek</option><option>Normal</option><option>Düşük</option></select></Field><Field label="Oda Sayısı"><input placeholder="2+1" value={form.oda_sayisi} onChange={s("oda_sayisi")}/></Field></FGrid>
        <Field label="Aranan Bölge"><input placeholder="Lara, Fener, Güzeloba" value={form.bolge} onChange={s("bolge")} style={{marginTop:14}}/></Field>
        <FGrid><Field label="Max Bütçe (TL)"><input placeholder="5000000" value={form.butce_max_tl} onChange={s("butce_max_tl")} style={{marginTop:14}}/></Field><Field label="İletişim"><input placeholder="05321234567" value={form.iletisim} onChange={s("iletisim")} style={{marginTop:14}}/></Field></FGrid>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:18}}><Btn v="ghost" onClick={()=>setModal(null)}>İptal</Btn><Btn v="green" onClick={submit}>✓ Ekle & Sheets'e Kaydet</Btn></div>
      </Modal>}
      {detay&&<Modal title={`🔍 ${detay.bolge||"Talep"}`} onClose={()=>setDetay(null)} width={700}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14,marginBottom:16}}>
          <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>İŞLEM</div><Bdg c="green">{detay.islem_tipi}</Bdg></div>
          <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>ODA</div><div style={{fontWeight:700}}>{detay.oda_sayisi||"—"}</div></div>
          <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>BÜTÇE</div><div style={{fontWeight:700,color:T.amberL}}>{fmt(detay.butce_max_tl)}</div></div>
          <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>İLETİŞİM</div><div style={{fontWeight:600}}>{detay.iletisim||"—"}</div></div>
          <div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>DURUM</div><Bdg c={detay.eslesme_durumu==="Eşleşti"?"green":"amber"}>{detay.eslesme_durumu}</Bdg></div>
        </div>
        <Divider label={`${eslesmeler.filter(e=>e.talep_id===detay.id).length} Eşleşme`}/>
        {eslesmeler.filter(e=>e.talep_id===detay.id).sort((a,b)=>b.skor-a.skor).map(e=>{const p=portfoyler.find(x=>x.id===e.portfoy_id);return(
          <div key={e.id} style={{background:"#080E1A",borderRadius:10,border:`1px solid ${T.b}`,padding:14,marginBottom:10}}>
            <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:10}}><Ring skor={e.skor}/><div style={{flex:1}}><div style={{fontWeight:700,fontSize:13,marginBottom:3}}>{p?.ilce||"—"} / {p?.mahalle||"—"}</div><div style={{fontSize:12,color:T.muted}}>{p?.oda_sayisi||"—"} · {fmt(p?.fiyat,p?.para_birimi)} · {p?.iletisim||"—"}</div></div>
            <Btn sz="xs" v="teal" onClick={()=>genMessage(detay,p)} loading={msgLoad}>✉ Mesaj</Btn></div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:4}}><SBar label="Bütçe" score={e.b} w={40}/><SBar label="Lokasyon" score={e.l} w={30}/><SBar label="Oda" score={e.o} w={20}/><SBar label="Tür" score={e.t} w={10}/></div>
            {genMsg&&<div style={{marginTop:10,background:"#0C1522",borderRadius:8,padding:12,border:`1px solid ${T.b}`}}><div style={{fontSize:11,color:T.teal,fontWeight:700,marginBottom:6}}>✉ Gemini Mesajı</div><p style={{fontSize:13,lineHeight:1.7}}>{genMsg}</p><Btn sz="xs" v="ghost" style={{marginTop:8}} onClick={()=>{navigator.clipboard?.writeText(genMsg);addToast("Kopyalandı","success");}}>📋 Kopyala</Btn></div>}
          </div>);})}
        <div style={{display:"flex",gap:8,marginTop:14}}><Btn sz="sm" v="ghost" onClick={()=>{onUpdate(detay.id,{eslesme_durumu:"Kapalı"});addToast("Kapatıldı","info");setDetay(null);}}>✓ Kapat</Btn><Btn v="ghost" onClick={()=>setDetay(null)}>Kapat</Btn></div>
      </Modal>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// PAGE: EŞLEŞMELER
// ═══════════════════════════════════════════════════════════════════
const PageEslesmeler=({eslesmeler,talepler,portfoyler,geminiKey,addToast})=>{
  const[min,setMin]=useState(0);const[q,setQ]=useState("");const[msgs,setMsgs]=useState({});const[loadId,setLoadId]=useState(null);
  const sorted=[...eslesmeler].filter(e=>e.skor>=min/100).filter(e=>{if(!q)return true;const t=talepler.find(x=>x.id===e.talep_id);const p=portfoyler.find(x=>x.id===e.portfoy_id);return trNorm(`${t?.bolge} ${p?.ilce} ${p?.mahalle}`).includes(trNorm(q));}).sort((a,b)=>b.skor-a.skor);
  const genMsg=async(e)=>{const t=talepler.find(x=>x.id===e.talep_id);const p=portfoyler.find(x=>x.id===e.portfoy_id);if(!t||!p||!geminiKey){addToast("Gemini anahtarı gerekli","error");return;}setLoadId(e.id);try{const msg=await callGemini(`Türkçe 3-4 cümle tanışma mesajı. Müşteri ${t.bolge||"—"}'de ${t.oda_sayisi||""} arıyor bütçe ${fmt(t.butce_max_tl)}. Portföy: ${p.ilce}/${p.mahalle} ${p.oda_sayisi} ${fmt(p.fiyat,p.para_birimi)}. Sadece mesaj.`,geminiKey);setMsgs(s=>({...s,[e.id]:msg}));}catch(err){addToast(err.message,"error");}setLoadId(null);};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
        <input placeholder="🔎 Bölge, ilçe…" value={q} onChange={e=>setQ(e.target.value)} style={{maxWidth:220}}/>
        <div style={{display:"flex",alignItems:"center",gap:10,background:T.card,border:`1px solid ${T.b}`,borderRadius:8,padding:"6px 12px"}}>
          <span style={{fontSize:12,color:T.muted}}>Min:</span>
          <input type="range" min={0} max={90} step={5} value={min} onChange={e=>setMin(+e.target.value)} style={{width:90,accentColor:T.blue,background:"transparent",border:"none",cursor:"pointer"}}/>
          <span style={{fontSize:12,fontWeight:700,color:T.blueL,minWidth:28}}>{min}%</span>
        </div>
        <div style={{marginLeft:"auto",display:"flex",gap:7}}><Bdg c="green">75%+: {sorted.filter(e=>e.skor>=.75).length}</Bdg><Bdg c="amber">55-75%: {sorted.filter(e=>e.skor>=.55&&e.skor<.75).length}</Bdg></div>
        <span style={{fontSize:12,color:T.muted}}>{sorted.length} eşleşme</span>
      </div>
      {sorted.length===0?<Card><p style={{color:T.muted,textAlign:"center",padding:60}}>Eşleşme bulunamadı</p></Card>:sorted.map((e,idx)=>{const t=talepler.find(x=>x.id===e.talep_id);const p=portfoyler.find(x=>x.id===e.portfoy_id);const msg=msgs[e.id];return(
        <Card key={e.id} style={{animation:`fadeUp .3s ease ${idx*.03}s both`}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 110px 1fr",gap:14,alignItems:"center",marginBottom:12}}>
            <div style={{background:"#080E1A",borderRadius:9,padding:12,borderLeft:`3px solid ${T.purple}`}}><div style={{fontSize:10,fontWeight:700,color:T.purple,textTransform:"uppercase",letterSpacing:".8px",marginBottom:7}}>🔍 Talep</div><div style={{fontWeight:700,fontSize:13,marginBottom:5}}>📍 {t?.bolge||"—"}</div><div style={{fontSize:11,color:T.muted,display:"flex",flexDirection:"column",gap:2}}><span>🛏 {t?.oda_sayisi||"—"}</span><span>💰 {fmt(t?.butce_max_tl)}</span>{t?.iletisim&&<span>📞 {t.iletisim}</span>}</div></div>
            <div style={{textAlign:"center",display:"flex",flexDirection:"column",alignItems:"center",gap:5}}><Ring skor={e.skor}/><div style={{fontSize:10,color:T.muted}}>{e.tarih}</div></div>
            <div style={{background:"#080E1A",borderRadius:9,padding:12,borderLeft:`3px solid ${T.blue}`}}><div style={{fontSize:10,fontWeight:700,color:T.blue,textTransform:"uppercase",letterSpacing:".8px",marginBottom:7}}>🏠 Portföy</div><div style={{fontWeight:700,fontSize:13,marginBottom:5}}>{p?.ilce||"—"} / {p?.mahalle||"—"}</div><div style={{fontSize:11,color:T.muted,display:"flex",flexDirection:"column",gap:2}}><span>🛏 {p?.oda_sayisi||"—"}</span><span>💰 {fmt(p?.fiyat,p?.para_birimi)}</span>{p?.iletisim&&<span>📞 {p.iletisim}</span>}</div></div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 18px",marginBottom:8}}><SBar label="💰 Bütçe" score={e.b} w={40}/><SBar label="📍 Lokasyon" score={e.l} w={30}/><SBar label="🛏 Oda" score={e.o} w={20}/><SBar label="✨ Tür" score={e.t} w={10}/></div>
          {msg&&<div style={{background:"#080E1A",borderRadius:8,padding:"10px 12px",marginBottom:8,border:`1px solid ${T.b}`}}><div style={{fontSize:11,color:T.teal,fontWeight:700,marginBottom:5}}>✉ Gemini Mesajı</div><p style={{fontSize:13,lineHeight:1.7}}>{msg}</p><Btn sz="xs" v="ghost" style={{marginTop:7}} onClick={()=>{navigator.clipboard?.writeText(msg);addToast("Kopyalandı","success");}}>📋 Kopyala</Btn></div>}
          <div style={{display:"flex",justifyContent:"flex-end"}}><Btn sz="xs" v="teal" onClick={()=>genMsg(e)} loading={loadId===e.id}>{msg?"✉ Yenile":"✉ Mesaj Oluştur"}</Btn></div>
        </Card>);})}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// PAGE: PIPELINE (Kanban)
// ═══════════════════════════════════════════════════════════════════
const STAGES=[{id:"lead",label:"🎯 Lead",color:T.blue},{id:"contact",label:"📞 İletişim",color:T.purple},{id:"showing",label:"🏠 Gezi",color:T.amber},{id:"offer",label:"📝 Teklif",color:"#F97316"},{id:"contract",label:"✍️ Sözleşme",color:T.teal},{id:"closed",label:"✅ Kapandı",color:T.green}];
const PagePipeline=({deals,onAddDeal,onUpdateDeal,onDeleteDeal,addToast})=>{
  const[modal,setModal]=useState(false);const[detay,setDetay]=useState(null);const[form,setForm]=useState({baslik:"",musteri:"",tel:"",deger:"",para_birimi:"TL",stage:"lead",notlar:""});
  const s=k=>e=>setForm(p=>({...p,[k]:e.target.value}));
  const submit=()=>{if(!form.baslik){addToast("Başlık gerekli","warning");return;}const deger=parseFloat(String(form.deger).replace(/[.\s]/g,"").replace(",","."))||null;onAddDeal({...form,id:uid(form.baslik,form.musteri,Date.now()),tarih:stamp(),deger});setModal(false);setForm({baslik:"",musteri:"",tel:"",deger:"",para_birimi:"TL",stage:"lead",notlar:""});};
  const move=(d,dir)=>{const idx=STAGES.findIndex(s=>s.id===d.stage);const ni=idx+dir;if(ni<0||ni>=STAGES.length)return;onUpdateDeal(d.id,{stage:STAGES[ni].id});};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{display:"flex",gap:10}}><Bdg c="blue">{deals.length} Deal</Bdg><Bdg c="green">Toplam {fmt(deals.filter(d=>d.stage==="closed").reduce((s,d)=>s+(d.deger||0),0))}</Bdg></div><Btn sz="sm" v="amber" onClick={()=>setModal(true)}>+ Deal Ekle</Btn></div>
      <div style={{display:"grid",gridTemplateColumns:`repeat(${STAGES.length},1fr)`,gap:10,overflowX:"auto",minWidth:0}}>
        {STAGES.map(stage=>{const sd=deals.filter(d=>d.stage===stage.id);const val=sd.reduce((s,d)=>s+(d.deger||0),0);return(
          <div key={stage.id} style={{minWidth:165}}>
            <div style={{padding:"9px 11px",borderRadius:"8px 8px 0 0",background:`${stage.color}15`,border:`1px solid ${stage.color}28`,borderBottom:"none"}}><div style={{fontSize:12,fontWeight:700,color:stage.color}}>{stage.label}</div><div style={{fontSize:10,color:T.muted,marginTop:1}}>{sd.length} · {fmt(val)}</div></div>
            <div style={{background:"#070D1A",border:`1px solid ${stage.color}18`,borderRadius:"0 0 8px 8px",minHeight:190,padding:7,display:"flex",flexDirection:"column",gap:7}}>
              {sd.map(d=><div key={d.id} style={{background:T.card,border:`1px solid ${T.b}`,borderRadius:8,padding:11,cursor:"pointer",transition:"border-color .15s"}} onMouseEnter={e=>e.currentTarget.style.borderColor=stage.color+"60"} onMouseLeave={e=>e.currentTarget.style.borderColor=T.b} onClick={()=>setDetay(d)}>
                <div style={{fontSize:12,fontWeight:700,marginBottom:3,lineHeight:1.4}}>{d.baslik}</div>
                {d.musteri&&<div style={{fontSize:11,color:T.muted,marginBottom:3}}>👤 {d.musteri}</div>}
                {d.deger&&<div style={{fontSize:12,fontWeight:700,color:T.amberL}}>{fmt(d.deger,d.para_birimi)}</div>}
                <div style={{display:"flex",gap:4,marginTop:7}}>
                  <button onClick={e=>{e.stopPropagation();move(d,-1);}} disabled={stage.id===STAGES[0].id} style={{background:"none",border:`1px solid ${T.b}`,color:T.muted,borderRadius:4,padding:"2px 6px",fontSize:10,cursor:"pointer",opacity:stage.id===STAGES[0].id?.3:1}}>←</button>
                  <button onClick={e=>{e.stopPropagation();move(d,1);}} disabled={stage.id===STAGES[STAGES.length-1].id} style={{background:"none",border:`1px solid ${T.b}`,color:T.muted,borderRadius:4,padding:"2px 6px",fontSize:10,cursor:"pointer",opacity:stage.id===STAGES[STAGES.length-1].id?.3:1}}>→</button>
                  <button onClick={e=>{e.stopPropagation();onDeleteDeal(d.id);addToast("Silindi","info");}} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:11,marginLeft:"auto",opacity:.7}}>🗑</button>
                </div>
              </div>)}
              {sd.length===0&&<div style={{textAlign:"center",padding:"22px 0",fontSize:12,color:T.muted,opacity:.4}}>Boş</div>}
            </div>
          </div>);})}
      </div>
      {modal&&<Modal title="📋 Yeni Deal" onClose={()=>setModal(false)}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}><Field label="Başlık"><input value={form.baslik} onChange={s("baslik")} placeholder="Lara 2+1 satış"/></Field><FGrid><Field label="Müşteri"><input value={form.musteri} onChange={s("musteri")} placeholder="Ahmet Yılmaz"/></Field><Field label="Değer (TL)"><input value={form.deger} onChange={s("deger")} placeholder="4800000"/></Field></FGrid><Field label="Aşama"><select value={form.stage} onChange={s("stage")}>{STAGES.map(st=><option key={st.id} value={st.id}>{st.label}</option>)}</select></Field><Field label="Notlar"><textarea value={form.notlar} onChange={s("notlar")} rows={2} placeholder="Notlar…"/></Field></div>
        <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16}}><Btn v="ghost" onClick={()=>setModal(false)}>İptal</Btn><Btn v="amber" onClick={submit}>✓ Deal Ekle</Btn></div>
      </Modal>}
      {detay&&<Modal title={`📋 ${detay.baslik}`} onClose={()=>setDetay(null)}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}><div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>AŞAMA</div><Bdg c="blue">{STAGES.find(s=>s.id===detay.stage)?.label||detay.stage}</Bdg></div><div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>DEĞER</div><div style={{fontWeight:700,fontSize:16,color:T.amberL}}>{fmt(detay.deger,detay.para_birimi)}</div></div><div><div style={{fontSize:11,color:T.muted,marginBottom:4}}>MÜŞTERİ</div><div style={{fontWeight:600}}>{detay.musteri||"—"}</div></div></div>
        <div style={{marginBottom:14}}><div style={{fontSize:11,color:T.muted,marginBottom:7,fontWeight:700}}>AŞAMA DEĞİŞTİR:</div><div style={{display:"flex",gap:5,flexWrap:"wrap"}}>{STAGES.map(st=><button key={st.id} onClick={()=>{onUpdateDeal(detay.id,{stage:st.id});setDetay(d=>({...d,stage:st.id}));addToast("Güncellendi","info");}} style={{background:detay.stage===st.id?`${st.color}22`:"transparent",border:`1px solid ${detay.stage===st.id?st.color:T.b}`,color:detay.stage===st.id?st.color:T.muted,borderRadius:6,padding:"5px 11px",fontSize:11,fontWeight:600,cursor:"pointer"}}>{st.label}</button>)}</div></div>
        <div style={{display:"flex",gap:8}}><Btn sz="sm" v="danger" onClick={()=>{onDeleteDeal(detay.id);setDetay(null);addToast("Silindi","info");}}>🗑</Btn><Btn sz="sm" v="ghost" onClick={()=>setDetay(null)}>Kapat</Btn></div>
      </Modal>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// PAGE: HESAPLAYICI
// ═══════════════════════════════════════════════════════════════════
const PageHesaplayici=()=>{
  const[tab,setTab]=useState("komisyon");const[sat,setSat]=useState({fiyat:"",oran:"2",vergi:"20"});const[kira,setKira]=useState({aylik:"",ay:"12",kAy:"1"});const[kur,setKur]=useState({miktar:"",birim:"EUR",kurEUR:"38.5",kurUSD:"35.5"});
  const K=()=>{const f=parseFloat(String(sat.fiyat).replace(/[.\s]/g,"").replace(",","."))||0;const o=parseFloat(sat.oran)||0;const v=parseFloat(sat.vergi)||0;const brut=f*(o/100);const kdv=brut*(v/100);return{brut,kdv,net:brut+kdv,f};};
  const KR=()=>{const a=parseFloat(String(kira.aylik).replace(/[.\s]/g,"").replace(",","."))||0;const ay=parseInt(kira.ay)||0;const ka=parseFloat(kira.kAy)||1;const kom=a*ka;return{yillik:a*ay,kom,kdv:kom*.2,net:kom+(kom*.2)};};
  const KU=()=>{const m=parseFloat(String(kur.miktar).replace(/[.\s]/g,"").replace(",","."))||0;const k=kur.birim==="EUR"?parseFloat(kur.kurEUR)||38.5:parseFloat(kur.kurUSD)||35.5;return{tl:m*k,k,b:kur.birim};};
  const k=K();const kr=KR();const ku=KU();
  const RR=({label,value,big,hl})=><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"11px 0",borderBottom:`1px solid ${T.b}`}}><span style={{fontSize:big?14:13,color:big?T.text:T.muted,fontWeight:big?600:400}}>{label}</span><span style={{fontSize:big?20:14,fontWeight:big?800:600,color:hl?T.green:T.text}}>{value}</span></div>;
  const TB=(id,l)=><button onClick={()=>setTab(id)} style={{padding:"8px 16px",borderRadius:8,border:"none",fontSize:13,fontWeight:tab===id?700:400,background:tab===id?"rgba(59,130,246,.12)":"transparent",color:tab===id?"#60A5FA":T.muted,cursor:"pointer"}}>{l}</button>;
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14,maxWidth:640}}>
      <Card style={{padding:"8px 8px 0"}}><div style={{display:"flex",gap:4}}>{TB("komisyon","🏠 Satış")}{TB("kira","🔑 Kira")}{TB("kur","💱 Döviz")}</div></Card>
      {tab==="komisyon"&&<><Card><h3 style={{fontSize:14,fontWeight:700,marginBottom:14}}>🏠 Satış Komisyon</h3><div style={{display:"flex",flexDirection:"column",gap:12}}><Field label="Satış Fiyatı (TL)"><input value={sat.fiyat} onChange={e=>setSat(p=>({...p,fiyat:e.target.value}))} placeholder="5000000"/></Field><FGrid><Field label="Komisyon Oranı (%)"><input type="number" value={sat.oran} onChange={e=>setSat(p=>({...p,oran:e.target.value}))} min={0} max={10} step={.5}/></Field><Field label="KDV (%)"><input type="number" value={sat.vergi} onChange={e=>setSat(p=>({...p,vergi:e.target.value}))} min={0} max={40}/></Field></FGrid></div></Card>
      <Card><h3 style={{fontSize:13,fontWeight:700,marginBottom:4}}>Sonuç</h3><RR label="Satış Fiyatı" value={fmt(k.f)}/><RR label={`Brüt Komisyon (%${sat.oran})`} value={fmt(k.brut)}/><RR label={`KDV (%${sat.vergi})`} value={fmt(k.kdv)}/><RR label="Net Tahsilat" value={fmt(k.net)} big hl/><div style={{marginTop:14,padding:12,background:"#080E1A",borderRadius:8,border:`1px solid ${T.b}`}}><div style={{fontSize:11,color:T.muted,marginBottom:4}}>Her iki taraftan toplam:</div><div style={{fontSize:24,fontWeight:800,color:T.green}}>{fmt(k.net*2)}</div></div></Card></>}
      {tab==="kira"&&<><Card><h3 style={{fontSize:14,fontWeight:700,marginBottom:14}}>🔑 Kira Komisyon</h3><div style={{display:"flex",flexDirection:"column",gap:12}}><Field label="Aylık Kira (TL)"><input value={kira.aylik} onChange={e=>setKira(p=>({...p,aylik:e.target.value}))} placeholder="25000"/></Field><FGrid><Field label="Kira Süresi (ay)"><input type="number" value={kira.ay} onChange={e=>setKira(p=>({...p,ay:e.target.value}))}/></Field><Field label="Komisyon (kaç ay)"><input type="number" value={kira.kAy} onChange={e=>setKira(p=>({...p,kAy:e.target.value}))} step={.5}/></Field></FGrid></div></Card>
      <Card><RR label="Yıllık Kira" value={fmt(kr.yillik)}/><RR label={`Komisyon (${kira.kAy} aylık)`} value={fmt(kr.kom)}/><RR label="KDV (%20)" value={fmt(kr.kdv)}/><RR label="Net Tahsilat" value={fmt(kr.net)} big hl/></Card></>}
      {tab==="kur"&&<><Card><h3 style={{fontSize:14,fontWeight:700,marginBottom:14}}>💱 Döviz Çevirici</h3><FGrid><Field label="Miktar"><input value={kur.miktar} onChange={e=>setKur(p=>({...p,miktar:e.target.value}))} placeholder="100000"/></Field><Field label="Birim"><select value={kur.birim} onChange={e=>setKur(p=>({...p,birim:e.target.value}))}><option>EUR</option><option>USD</option></select></Field><Field label="EUR/TL"><input type="number" value={kur.kurEUR} onChange={e=>setKur(p=>({...p,kurEUR:e.target.value}))} step={.1}/></Field><Field label="USD/TL"><input type="number" value={kur.kurUSD} onChange={e=>setKur(p=>({...p,kurUSD:e.target.value}))} step={.1}/></Field></FGrid></Card>
      <Card><RR label={`${kur.miktar||"0"} ${ku.b}`} value={`= ${fmt(ku.tl)} ₺`} big hl/><RR label="Kur" value={`1 ${ku.b} = ${ku.k} ₺`}/><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>{[1e6,2e6,3e6,5e6].map(v=><div key={v} style={{background:"#080E1A",borderRadius:8,padding:"10px 12px",textAlign:"center",border:`1px solid ${T.b}`}}><div style={{fontSize:11,color:T.muted,marginBottom:2}}>{fmt(v,ku.b)}</div><div style={{fontSize:14,fontWeight:700,color:T.blueL}}>{fmt(v*ku.k)}</div></div>)}</div></Card></>}
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// PAGE: AYARLAR
// ═══════════════════════════════════════════════════════════════════
const PageAyarlar=({config,onSave,portfoyler,talepler,eslesmeler,deals,onClear,addToast,onTestSheets,onTestGemini,sheetsOk,geminiOk,syncing})=>{
  const[form,setForm]=useState({appsScriptUrl:config.appsScriptUrl||"",geminiKey:config.geminiKey||""});const[showKey,setShowKey]=useState(false);const[testing,setTesting]=useState("");
  const test=async(service)=>{
    setTesting(service);
    if(service==="sheets"){const ok=await onTestSheets(form.appsScriptUrl);addToast(ok?"Google Sheets bağlantısı başarılı ✓":"Sheets bağlantı hatası. URL'yi kontrol edin",ok?"success":"error");}
    if(service==="gemini"){const ok=await onTestGemini(form.geminiKey);addToast(ok?"Gemini API bağlantısı başarılı ✓":"Gemini API hatası. Anahtarı kontrol edin",ok?"success":"error");}
    setTesting("");
  };
  const exportData=()=>{const d=JSON.stringify({portfoyler,talepler,eslesmeler,deals,exportDate:stamp()},null,2);const b=new Blob([d],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.download=`ai_deal_match_${new Date().toISOString().slice(0,10)}.json`;a.click();addToast("Dışa aktarıldı","success");};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:16,maxWidth:660}}>
      <Card>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}><h3 style={{fontSize:14,fontWeight:700}}>🔗 Google Apps Script URL</h3><ApiStatus sheetsOk={sheetsOk} geminiOk={geminiOk} syncing={syncing}/></div>
        <p style={{fontSize:12,color:T.muted,marginBottom:12}}>Google Apps Script web app URL'si — Google Sheets veritabanına bağlanır.</p>
        <input value={form.appsScriptUrl} onChange={e=>setForm(p=>({...p,appsScriptUrl:e.target.value}))} placeholder="https://script.google.com/macros/s/.../exec" style={{marginBottom:10,fontFamily:"'JetBrains Mono',monospace",fontSize:12}}/>
        <div style={{display:"flex",gap:8}}><Btn sz="sm" v="ghost" onClick={()=>test("sheets")} loading={testing==="sheets"}>🔌 Test Et</Btn></div>
      </Card>
      <Card>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:4}}>🤖 Gemini API Anahtarı</h3>
        <p style={{fontSize:12,color:T.muted,marginBottom:12}}>Ücretsiz: <a href="https://makersuite.google.com/app/apikey" target="_blank" style={{color:T.blue}}>aistudio.google.com</a> → Get API Key (gemini-1.5-flash ücretsiz)</p>
        <div style={{display:"flex",gap:8,marginBottom:10}}><input type={showKey?"text":"password"} value={form.geminiKey} onChange={e=>setForm(p=>({...p,geminiKey:e.target.value}))} placeholder="AIza…" style={{flex:1,fontFamily:"'JetBrains Mono',monospace",fontSize:12}}/><button onClick={()=>setShowKey(v=>!v)} style={{background:T.elev,border:`1px solid ${T.b}`,color:T.muted,borderRadius:8,padding:"9px 11px",cursor:"pointer",fontSize:13}}>{showKey?"🙈":"👁"}</button></div>
        <div style={{display:"flex",gap:8}}><Btn sz="sm" v="ghost" onClick={()=>test("gemini")} loading={testing==="gemini"}>🔌 Test Et</Btn></div>
      </Card>
      <Card style={{padding:16}}>
        <Btn full v="primary" onClick={()=>{onSave(form);addToast("Ayarlar kaydedildi","success");}}>💾 Tüm Ayarları Kaydet</Btn>
      </Card>
      <Card>
        <h3 style={{fontSize:14,fontWeight:700,marginBottom:14}}>🗄️ Veri Yönetimi</h3>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:14}}>
          {[{l:"Portföy",v:portfoyler.length,c:T.blue},{l:"Talep",v:talepler.length,c:T.purple},{l:"Eşleşme",v:eslesmeler.length,c:T.green},{l:"Deal",v:deals.length,c:T.amber}].map(s=><div key={s.l} style={{background:"#080E1A",borderRadius:9,padding:"12px 14px",textAlign:"center",border:`1px solid ${T.b}`}}><div style={{fontSize:26,fontWeight:800,color:s.c}}>{s.v}</div><div style={{fontSize:11,color:T.muted}}>{s.l}</div></div>)}
        </div>
        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}><Btn v="outline" sz="sm" onClick={exportData}>📤 JSON Export</Btn><Btn v="danger" sz="sm" onClick={()=>{if(!confirm("TÜM VERİLER SİLİNECEK?"))return;onClear();addToast("Temizlendi","warning");}}>🗑 Sıfırla</Btn></div>
      </Card>
      <Card style={{background:"linear-gradient(135deg,#0A1628,#0D1E35)"}}>
        <div style={{display:"flex",gap:14,alignItems:"center"}}><div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#1D4ED8,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>🏠</div><div><div style={{fontWeight:800,fontSize:15,marginBottom:3}}>AI Deal Match v3.0</div><div style={{fontSize:12,color:T.muted,lineHeight:1.7}}>Vercel hosting · Google Sheets DB · Gemini AI · Apps Script API</div></div></div>
      </Card>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════════
const NAV=[{id:"dashboard",icon:"📊",label:"Dashboard"},{id:"import",icon:"📥",label:"WA Import"},{id:"portfoy",icon:"🏠",label:"Portföy"},{id:"talepler",icon:"🔍",label:"Talepler"},{id:"eslesmeler",icon:"🤝",label:"Eşleşmeler"},{id:"pipeline",icon:"📋",label:"Pipeline"},{id:"hesaplayici",icon:"🧮",label:"Hesaplayıcı"},{id:"ayarlar",icon:"⚙️",label:"Ayarlar"}];

export default function App() {
  const[page,setPage]=useState("dashboard");
  const[portfoyler,setPortfoyler]=useState([]);const[talepler,setTalepler]=useState([]);const[eslesmeler,setEslesmeler]=useState([]);const[deals,setDeals]=useState([]);const[activities,setActivities]=useState([]);
  const[config,setConfig]=useState({appsScriptUrl:"",geminiKey:""});
  const[sheetsOk,setSheetsOk]=useState(false);const[geminiOk,setGeminiOk]=useState(false);const[syncing,setSyncing]=useState(false);
  const[toasts,setToasts]=useState([]);const[sideOpen,setSideOpen]=useState(true);
  const[loaded,setLoaded]=useState(false);

  // ── Load from storage, then sync from Sheets ──
  useEffect(()=>{
    (async()=>{
      try{
        const savedCfg=localStorage.getItem("adm_config");
        if(savedCfg){const c=JSON.parse(savedCfg);setConfig(c);
          if(c.appsScriptUrl){
            setSyncing(true);
            try{
              const r=await fetch(`${c.appsScriptUrl}?action=getAll`,{method:"POST",body:JSON.stringify({action:"getAll"}),redirect:"follow"});
              const d=await r.json();
              if(d.ok&&d.data){
                if(d.data.portfoy)setPortfoyler(d.data.portfoy);
                if(d.data.talepler)setTalepler(d.data.talepler);
                if(d.data.eslesmeler)setEslesmeler(d.data.eslesmeler);
                if(d.data.deals)setDeals(d.data.deals);
                if(d.data.activities)setActivities(d.data.activities);
                setSheetsOk(true);
              }
            }catch{} setSyncing(false);
          }
          if(c.geminiKey){try{await callGemini("Merhaba",c.geminiKey);setGeminiOk(true);}catch{}}
        }
      }catch{}
      // Fallback to localStorage
      try{const lp=localStorage.getItem("adm_p");if(lp)setPortfoyler(JSON.parse(lp));}catch{}
      try{const lt=localStorage.getItem("adm_t");if(lt)setTalepler(JSON.parse(lt));}catch{}
      try{const le=localStorage.getItem("adm_e");if(le)setEslesmeler(JSON.parse(le));}catch{}
      try{const ld=localStorage.getItem("adm_d");if(ld)setDeals(JSON.parse(ld));}catch{}
      try{const la=localStorage.getItem("adm_a");if(la)setActivities(JSON.parse(la));}catch{}
      setLoaded(true);
    })();
  },[]);

  // ── Persist to localStorage always ──
  useEffect(()=>{if(!loaded)return;localStorage.setItem("adm_p",JSON.stringify(portfoyler));},[portfoyler,loaded]);
  useEffect(()=>{if(!loaded)return;localStorage.setItem("adm_t",JSON.stringify(talepler));},[talepler,loaded]);
  useEffect(()=>{if(!loaded)return;localStorage.setItem("adm_e",JSON.stringify(eslesmeler));},[eslesmeler,loaded]);
  useEffect(()=>{if(!loaded)return;localStorage.setItem("adm_d",JSON.stringify(deals));},[deals,loaded]);
  useEffect(()=>{if(!loaded)return;localStorage.setItem("adm_a",JSON.stringify(activities));},[activities,loaded]);

  // ── API helpers ──
  const sheetAdd=useCallback(async(tab,row)=>{if(!config.appsScriptUrl)return;try{await fetch(`${config.appsScriptUrl}?action=addRow`,{method:"POST",body:JSON.stringify({action:"addRow",tab,row}),redirect:"follow"});}catch{}},[config]);
  const sheetUpdate=useCallback(async(tab,id,patch)=>{if(!config.appsScriptUrl)return;try{await fetch(`${config.appsScriptUrl}?action=updateRow`,{method:"POST",body:JSON.stringify({action:"updateRow",tab,id,patch}),redirect:"follow"});}catch{}},[config]);
  const sheetDelete=useCallback(async(tab,id)=>{if(!config.appsScriptUrl)return;try{await fetch(`${config.appsScriptUrl}?action=deleteRow`,{method:"POST",body:JSON.stringify({action:"deleteRow",tab,id}),redirect:"follow"});}catch{}},[config]);
  const sheetDeleteByField=useCallback(async(tab,field,value)=>{if(!config.appsScriptUrl)return;try{await fetch(`${config.appsScriptUrl}?action=deleteByField`,{method:"POST",body:JSON.stringify({action:"deleteByField",tab,field,value}),redirect:"follow"});}catch{}},[config]);

  const addToast=useCallback((message,type="success")=>{const id=Date.now()+Math.random();setToasts(p=>[...p,{id,message,type}]);},[]);
  const addAct=useCallback((text,icon="📌")=>{const e={text,icon,tarih:stamp()};setActivities(p=>{const n=[...p,e].slice(-50);return n;});},[]);

  // ── Match runner ──
  const runMatches=useCallback((pList,tList,eList)=>{
    const newE=[];
    for(const t of tList){for(const res of match(t,pList)){const eid=uid(t.id,res.portfoy.id);if(!eList.some(e=>e.id===eid)&&!newE.some(e=>e.id===eid)){newE.push({id:eid,talep_id:t.id,portfoy_id:res.portfoy.id,skor:res.skor,b:res.b,l:res.l,o:res.o,t:res.t,tarih:stamp(),talep_ozet:`${t.bolge||"—"} · ${t.oda_sayisi||"—"} · ${fmt(t.butce_max_tl)}`});}}}
    return newE;
  },[]);

  // ── CRUD ──
  const addPortfoy=useCallback((p,silent=false)=>{
    setPortfoyler(prev=>{if(prev.some(x=>x.id===p.id))return prev;const next=[p,...prev];
    setTalepler(tList=>{setEslesmeler(eList=>{const ne=runMatches([p],tList,eList);if(ne.length){ne.forEach(e=>sheetAdd("eslesmeler",e));const upd=[...ne,...eList];return upd;}return eList;});return tList;});
    sheetAdd("portfoy",p);if(!silent)addAct(`🏠 ${p.ilce}/${p.mahalle||"—"} ${p.oda_sayisi||""} ${fmt(p.fiyat,p.para_birimi)}`,"🏠");return next;});
  },[sheetAdd,addAct,runMatches]);

  const deletePortfoy=useCallback(id=>{setPortfoyler(p=>p.filter(x=>x.id!==id));setEslesmeler(e=>e.filter(x=>x.portfoy_id!==id));sheetDelete("portfoy",id);sheetDeleteByField("eslesmeler","portfoy_id",id);},[sheetDelete,sheetDeleteByField]);

  const addTalep=useCallback((t,silent=false)=>{
    setTalepler(prev=>{if(prev.some(x=>x.id===t.id))return prev;const next=[t,...prev];
    setPortfoyler(pList=>{setEslesmeler(eList=>{const ne=runMatches(pList,[t],eList);if(ne.length){ne.forEach(e=>sheetAdd("eslesmeler",e));const upd=[...ne,...eList];if(!silent&&ne.length)addToast(`${ne.length} eşleşme bulundu! 🤝`,"success");return upd;}return eList;});return pList;});
    sheetAdd("talepler",t);if(!silent)addAct(`🔍 ${t.bolge||"—"} ${t.oda_sayisi||""} max ${fmt(t.butce_max_tl)}`,"🔍");return next;});
  },[sheetAdd,addAct,addToast,runMatches]);

  const deleteTalep=useCallback(id=>{setTalepler(p=>p.filter(x=>x.id!==id));setEslesmeler(e=>e.filter(x=>x.talep_id!==id));sheetDelete("talepler",id);sheetDeleteByField("eslesmeler","talep_id",id);},[sheetDelete,sheetDeleteByField]);
  const updateTalep=useCallback((id,patch)=>{setTalepler(p=>p.map(x=>x.id===id?{...x,...patch}:x));sheetUpdate("talepler",id,patch);},[sheetUpdate]);
  const addDeal=useCallback(d=>{setDeals(p=>[d,...p]);sheetAdd("deals",d);addToast("Deal eklendi","success");addAct(`📋 ${d.baslik} ${fmt(d.deger,d.para_birimi)}`,"📋");},[sheetAdd,addToast,addAct]);
  const updateDeal=useCallback((id,patch)=>{setDeals(p=>p.map(x=>x.id===id?{...x,...patch}:x));sheetUpdate("deals",id,patch);},[sheetUpdate]);
  const deleteDeal=useCallback(id=>{setDeals(p=>p.filter(x=>x.id!==id));sheetDelete("deals",id);},[sheetDelete]);

  const clearAll=useCallback(()=>{setPortfoyler([]);setTalepler([]);setEslesmeler([]);setDeals([]);setActivities([]);["adm_p","adm_t","adm_e","adm_d","adm_a"].forEach(k=>localStorage.removeItem(k));},[]);

  const testSheets=useCallback(async(url)=>{try{const r=await fetch(`${url}?action=ping`,{method:"POST",body:JSON.stringify({action:"ping"}),redirect:"follow"});const d=await r.json();setSheetsOk(d.ok||false);return d.ok||false;}catch{setSheetsOk(false);return false;}},[]);
  const testGemini=useCallback(async(key)=>{try{await callGemini("test",key);setGeminiOk(true);return true;}catch{setGeminiOk(false);return false;}},[]);

  const saveConfig=useCallback(cfg=>{setConfig(cfg);localStorage.setItem("adm_config",JSON.stringify(cfg));},[]);

  const pages={
    dashboard:<PageDashboard portfoyler={portfoyler} talepler={talepler} eslesmeler={eslesmeler} deals={deals} activities={activities} onNavigate={setPage}/>,
    import:<PageImport geminiKey={config.geminiKey} portfoyler={portfoyler} talepler={talepler} onAddPortfoy={addPortfoy} onAddTalep={addTalep} onNavigate={setPage}/>,
    portfoy:<PagePortfoy portfoyler={portfoyler} eslesmeler={eslesmeler} onAdd={addPortfoy} onDelete={deletePortfoy} addToast={addToast}/>,
    talepler:<PageTalepler talepler={talepler} eslesmeler={eslesmeler} portfoyler={portfoyler} onAdd={addTalep} onDelete={deleteTalep} onUpdate={updateTalep} addToast={addToast} geminiKey={config.geminiKey}/>,
    eslesmeler:<PageEslesmeler eslesmeler={eslesmeler} talepler={talepler} portfoyler={portfoyler} geminiKey={config.geminiKey} addToast={addToast}/>,
    pipeline:<PagePipeline deals={deals} onAddDeal={addDeal} onUpdateDeal={updateDeal} onDeleteDeal={deleteDeal} addToast={addToast}/>,
    hesaplayici:<PageHesaplayici/>,
    ayarlar:<PageAyarlar config={config} onSave={saveConfig} portfoyler={portfoyler} talepler={talepler} eslesmeler={eslesmeler} deals={deals} onClear={clearAll} addToast={addToast} onTestSheets={testSheets} onTestGemini={testGemini} sheetsOk={sheetsOk} geminiOk={geminiOk} syncing={syncing}/>,
  };

  return(<>
    <style>{CSS}</style>
    <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
      <aside style={{width:sideOpen?212:56,flexShrink:0,background:"#06090F",borderRight:`1px solid ${T.b}`,display:"flex",flexDirection:"column",transition:"width .2s",overflow:"hidden"}}>
        <div style={{padding:"14px 12px",borderBottom:`1px solid ${T.b}`,display:"flex",alignItems:"center",gap:9,cursor:"pointer"}} onClick={()=>setSideOpen(o=>!o)}>
          <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#1D4ED8,#7C3AED)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>🏠</div>
          {sideOpen&&<div style={{animation:"fadeUp .2s"}}><div style={{fontSize:13,fontWeight:800,letterSpacing:"-.3px",lineHeight:1.1}}>AI Deal Match</div><div style={{fontSize:10,color:T.muted}}>v3.0 · Antalya</div></div>}
        </div>
        <nav style={{flex:1,padding:"8px 6px",display:"flex",flexDirection:"column",gap:2,overflow:"auto"}}>
          {NAV.map(n=><button key={n.id} onClick={()=>setPage(n.id)} style={{display:"flex",alignItems:"center",gap:9,padding:"8px 9px",borderRadius:8,border:"none",textAlign:"left",background:page===n.id?"rgba(59,130,246,.12)":"transparent",color:page===n.id?"#60A5FA":T.muted,borderLeft:page===n.id?`2px solid ${T.blue}`:"2px solid transparent",cursor:"pointer",transition:"all .15s",width:"100%",marginLeft:-2,whiteSpace:"nowrap"}}>
            <span style={{fontSize:15,flexShrink:0}}>{n.icon}</span>
            {sideOpen&&<><span style={{fontSize:12.5,fontWeight:page===n.id?600:400,flex:1,animation:"fadeUp .2s"}}>{n.label}</span>{n.id==="eslesmeler"&&eslesmeler.filter(e=>e.skor>=.75).length>0&&<span style={{background:T.red,color:"#fff",borderRadius:10,padding:"1px 6px",fontSize:10,fontWeight:700}}>{eslesmeler.filter(e=>e.skor>=.75).length}</span>}</>}
          </button>)}
        </nav>
        {sideOpen&&<div style={{padding:"10px 12px",borderTop:`1px solid ${T.b}`,display:"flex",gap:8,fontSize:11}}>
          {[{v:portfoyler.length,c:T.blue,l:"P"},{v:talepler.filter(t=>t.eslesme_durumu==="Bekliyor").length,c:T.purple,l:"T"},{v:eslesmeler.length,c:T.green,l:"E"}].map((s,i)=><div key={i} style={{flex:1,textAlign:"center",background:`${s.c}10`,borderRadius:5,padding:"4px 0"}}><div style={{fontWeight:800,color:s.c,fontSize:13}}>{s.v}</div><div style={{color:T.muted,fontSize:9}}>{s.l}</div></div>)}
        </div>}
      </aside>
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
        <header style={{height:50,borderBottom:`1px solid ${T.b}`,display:"flex",alignItems:"center",gap:14,padding:"0 18px",background:"#06090F",flexShrink:0}}>
          <div style={{flex:1,display:"flex",alignItems:"center",gap:10}}><span style={{fontSize:17}}>{NAV.find(n=>n.id===page)?.icon}</span><h1 style={{fontSize:15,fontWeight:700}}>{NAV.find(n=>n.id===page)?.label}</h1>
          {!config.appsScriptUrl&&page!=="ayarlar"&&<button onClick={()=>setPage("ayarlar")} style={{background:"rgba(245,158,11,.1)",border:"1px solid rgba(245,158,11,.25)",color:T.amberL,borderRadius:6,padding:"3px 9px",fontSize:11,cursor:"pointer",fontWeight:600}}>⚙ Sheets URL Gerekli</button>}
          {syncing&&<div style={{display:"flex",alignItems:"center",gap:5,fontSize:11,color:T.muted}}><span style={{width:6,height:6,borderRadius:"50%",background:T.blue,animation:"pulse 1s infinite"}}/>Sheets ile senkronize…</div>}
          </div>
          <div style={{display:"flex",gap:6}}>
            {[{v:portfoyler.length,c:T.blue,l:"🏠"},{v:talepler.filter(t=>t.eslesme_durumu==="Bekliyor").length,c:T.purple,l:"🔍"},{v:eslesmeler.length,c:T.green,l:"🤝"}].map((s,i)=><div key={i} style={{background:`${s.c}12`,border:`1px solid ${s.c}22`,borderRadius:5,padding:"3px 7px",fontSize:11,color:s.c,fontWeight:700}}>{s.l} {s.v}</div>)}
          </div>
          <ApiStatus sheetsOk={sheetsOk} geminiOk={geminiOk} syncing={syncing}/>
        </header>
        <main style={{flex:1,overflow:"auto",padding:18}}><div key={page} style={{animation:"fadeUp .25s ease",maxWidth:1360}}>{pages[page]}</div></main>
      </div>
    </div>
    <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,display:"flex",flexDirection:"column",gap:8}}>
      {toasts.map(t=><Toast key={t.id} message={t.message} type={t.type} onClose={()=>setToasts(p=>p.filter(x=>x.id!==t.id))}/>)}
    </div>
  </>);
}
