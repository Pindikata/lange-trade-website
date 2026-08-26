const menu=document.querySelector(".menu");const nav=document.getElementById("navigation");if(menu&&nav){menu.addEventListener("click",()=>{const open=nav.classList.toggle("open");menu.setAttribute("aria-expanded",String(open));menu.setAttribute("aria-label",open?"Close navigation":"Open navigation")});nav.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>{nav.classList.remove("open");menu.setAttribute("aria-expanded","false")}));document.addEventListener("keydown",e=>{if(e.key==="Escape"){nav.classList.remove("open");menu.setAttribute("aria-expanded","false")}})}const year=document.getElementById("year");if(year)year.textContent=new Date().getFullYear();
const SUPABASE_URL="https://jekreqfctldkiugeenza.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_YZcjVmmUyfBGJTfrF3NioQ_okw0MyHW";
function enquiryRef(){const d=new Date();return `LT-${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}-${Math.floor(1000+Math.random()*9000)}`;}
async function loadSupabase(){if(window.supabase)return window.supabase;await new Promise((r,j)=>{const s=document.createElement("script");s.src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";s.onload=r;s.onerror=j;document.head.appendChild(s)});return window.supabase}
const tradeForm=document.getElementById("tradeEnquiryForm"),formStatus=document.getElementById("formStatus");
if(tradeForm&&formStatus){tradeForm.addEventListener("submit",async e=>{e.preventDefault();formStatus.className="form-status";if(!tradeForm.checkValidity()){tradeForm.reportValidity();return}if(SUPABASE_URL.startsWith("YOUR_")){formStatus.className="form-status show error";formStatus.textContent="The enquiry system is not connected yet. Please use WhatsApp or email while the backend is being activated.";return}const b=tradeForm.querySelector(".submit-button"),original=b.innerHTML;b.disabled=true;b.innerHTML="<span>Submitting…</span><span>→</span>";try{const lib=await loadSupabase(),c=lib.createClient(SUPABASE_URL,SUPABASE_ANON_KEY),fd=new FormData(tradeForm),ref=enquiryRef();let attachment_path=null,file=fd.get("attachment");if(file&&file.size){if(file.size>10485760)throw new Error("Attachment exceeds 10 MB");const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"_"),path=`${ref}/${Date.now()}-${safe}`;const {error:u}=await c.storage.from("enquiry-attachments").upload(path,file);if(u)throw u;attachment_path=path}const payload={reference:ref,full_name:fd.get("full_name"),company:fd.get("company")||null,email:fd.get("email"),phone:fd.get("phone"),country:fd.get("country"),destination:fd.get("destination"),product:fd.get("product"),quantity:fd.get("quantity"),timeline:fd.get("timeline")||null,budget:fd.get("budget")||null,incoterm:fd.get("incoterm")||null,details:fd.get("details"),attachment_path,status:"New"};const {error}=await c.from("trade_enquiries").insert(payload);if(error)throw error;tradeForm.reset();formStatus.className="form-status show success";formStatus.innerHTML=`Thank you. Your enquiry has been received. Reference: <strong>${ref}</strong>. Lange will follow up using the contact details you provided.`}catch(err){console.error(err);formStatus.className="form-status show error";formStatus.textContent="We could not submit the enquiry. Please try again or contact Lange directly by WhatsApp or email."}finally{b.disabled=false;b.innerHTML=original}})}


(() => {
  "use strict";
  const FX_FUNCTION_URL="https://jekreqfctldkiugeenza.supabase.co/functions/v1/pacific-fx";
  const currencies=[
    {code:"PGK",name:"Papua New Guinea Kina",decimals:2},
    {code:"SBD",name:"Solomon Islands Dollar",decimals:2},
    {code:"FJD",name:"Fiji Dollar",decimals:2},
    {code:"VUV",name:"Vanuatu Vatu",decimals:0},
    {code:"WST",name:"Samoan Tala",decimals:2},
    {code:"TOP",name:"Tongan Paʻanga",decimals:2},
    {code:"XPF",name:"CFP Franc",decimals:0},
    {code:"AUD",name:"Australian Dollar",decimals:2},
    {code:"NZD",name:"New Zealand Dollar",decimals:2}
  ];
  const amountInput=document.getElementById("fxAmount"),baseSelect=document.getElementById("fxBase"),refreshButton=document.getElementById("fxRefresh"),grid=document.getElementById("fxRateGrid"),statusText=document.getElementById("fxStatus"),updatedText=document.getElementById("fxUpdated");
  if(!amountInput||!baseSelect||!refreshButton||!grid)return;
  let data=null;
  const amount=()=>{const n=Number(amountInput.value);return Number.isFinite(n)&&n>0?Math.min(n,1e9):0};
  const fmt=(n,d)=>new Intl.NumberFormat("en-US",{minimumFractionDigits:d,maximumFractionDigits:d}).format(n);
  function render(){
    if(!data?.bases)return;
    const a=amount(),base=baseSelect.value,rates=data.bases[base];
    if(!a){grid.innerHTML='<div class="fx-error">Enter an amount greater than zero.</div>';return}
    grid.innerHTML=currencies.map(c=>{const r=Number(rates?.[c.code]);if(!Number.isFinite(r)||r<=0)return"";return `<article class="fx-rate-card"><span class="fx-rate-code">${c.code}</span><span class="fx-rate-name">${c.name}</span><div class="fx-rate-value">${fmt(a*r,c.decimals)}</div><div class="fx-rate-unit">${fmt(a,2)} ${base} · 1 ${base} = ${fmt(r,4)} ${c.code}</div></article>`}).join("");
  }
  function stamp(p){const raw=p.provider_updated_at||p.fetched_at;if(!raw){updatedText.textContent="";return}const d=new Date(raw);updatedText.textContent=Number.isNaN(d.getTime())?"":`Provider update: ${new Intl.DateTimeFormat("en",{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"}).format(d)}`}
  async function load(){
    refreshButton.disabled=true;statusText.textContent="Loading latest reference rates…";
    try{
      const res=await fetch(FX_FUNCTION_URL,{headers:{accept:"application/json"}});
      const p=await res.json();
      if(!res.ok||p.status!=="ok")throw new Error(p.message||"Rates unavailable");
      data=p;statusText.textContent=p.source==="stale-cache"?"Showing the most recent available cached reference rates.":"Latest indicative reference rates available.";stamp(p);render();
    }catch(e){console.error(e);statusText.textContent="Exchange-rate service is temporarily unavailable.";updatedText.textContent="";grid.innerHTML='<div class="fx-error">We could not load the latest reference rates. Please try again shortly.</div>'}
    finally{refreshButton.disabled=false}
  }
  amountInput.addEventListener("input",render);baseSelect.addEventListener("change",render);refreshButton.addEventListener("click",load);load();
})();
