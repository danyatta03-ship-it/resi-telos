// SCHEMA — struttura completa dell'app
(function(){
  const KEY='app-schema', DP='app-data:', SP='app-subm:', CSS='app-css';

  const DEFAULT = {
    site: {
      name:"La mia azienda", shortName:"MiaApp", themeColor:"#0b0f14",
      favicon:"", customCss:"",
    },
    brand: { name:"La mia azienda", logo:"" },
    theme: { primary:"#3B9FD4", bg:"#0b0f14", panel:"#141a22", panel2:"#1b232d",
             border:"#2a3441", text:"#e6edf3", muted:"#8a97a8", danger:"#d64545",
             ok:"#3fbf6f", warn:"#ff9800" },
    header: { show:true, sticky:true, bg:"", text:"", align:"left",
              logoPos:"left", logoSize:36, title:"La mia azienda", subtitle:"Sistema aziendale",
              showNav:true },
    footer: { show:true, bg:"", text:"", cols:[
      { title:"Contatti", items:["Via Roma 1, Milano","+39 000 000 000","info@azienda.it"] },
      { title:"Link utili", items:["Chi siamo","Servizi","Contatti","Privacy"] },
      { title:"Seguici", items:["LinkedIn","Instagram","Facebook"] },
    ], copy:"© 2026 La mia azienda — tutti i diritti riservati" },
    pages: [
      { id:"home", name:"Home", icon:"🏠", hideFromNav:false,
        settings:{bg:"",padding:0,hideHeader:false,hideFooter:false,seoTitle:"",seoDesc:""},
        blocks:[
          { id:"h1", type:"hero", bg:"#141a22", overlay:.35, bgImage:"", height:340, align:"center",
            title:"Soluzioni per la tua azienda", subtitle:"Qualità, professionalità, risultati.",
            ctas:[{label:"Scopri i servizi", style:"primary", action:{type:"goto",page:"servizi"}},
                  {label:"Contattaci", style:"ghost", action:{type:"goto",page:"contatti"}}] },
          { id:"h2", type:"section", title:"Perché sceglierci", subtitle:"Tre motivi in poche parole",
            bg:"", padding:24, align:"center",
            children:[
              { id:"h2c", type:"columns", cols:3, gap:16, cols_content:[
                [{id:"c1",type:"card",title:"🚀 Veloci",text:"Rispondiamo entro 24h."}],
                [{id:"c2",type:"card",title:"🛡️ Affidabili",text:"10 anni di esperienza."}],
                [{id:"c3",type:"card",title:"💡 Innovativi",text:"Tecnologie all'avanguardia."}]
              ]}
            ]},
          { id:"h3", type:"stat-grid", cols:3, items:[
            {number:"120+", label:"Clienti"},
            {number:"98%",  label:"Soddisfazione"},
            {number:"10",   label:"Anni di esperienza"}
          ]},
        ]},
      { id:"servizi", name:"Servizi", icon:"🧰",
        settings:{bg:"",padding:0,hideHeader:false,hideFooter:false},
        blocks:[
          { id:"s0", type:"text", tag:"h1", text:"I nostri servizi", align:"center", fontSize:28, fontWeight:"800", padding:16 },
          { id:"s1", type:"card-grid", cols:3, gap:12, items:[
            {image:"", title:"Consulenza", text:"Analisi e strategia su misura.", link:"", linkLabel:"Scopri"},
            {image:"", title:"Sviluppo",   text:"Realizziamo il prodotto giusto.", link:"", linkLabel:"Scopri"},
            {image:"", title:"Supporto",   text:"Assistenza continua nel tempo.", link:"", linkLabel:"Scopri"},
          ]},
          { id:"s2", type:"accordion", items:[
            {title:"Come iniziare?", content:"Contattaci e fissiamo un incontro conoscitivo gratuito."},
            {title:"Quali sono i tempi?", content:"Ogni progetto è unico: media 4-8 settimane."},
            {title:"Costi?", content:"Preventivo su misura senza impegno."},
          ]}
        ]},
      { id:"pratiche", name:"Pratiche", icon:"📋",
        settings:{bg:"",padding:0,hideHeader:false,hideFooter:false},
        blocks:[
          { id:"tbl_p", type:"table", title:"Elenco pratiche", storageKey:"pratiche",
            columns:[
              { key:"id",   label:"ID",       type:"text" },
              { key:"forn", label:"Fornitore",type:"text" },
              { key:"stato",label:"Stato",    type:"select", options:["Aperta","In lavorazione","Chiusa"] },
              { key:"data", label:"Data",     type:"date" }
            ],
            allowAdd:true, allowDelete:true, allowEdit:true, allowExport:true }
        ]},
      { id:"contatti", name:"Contatti", icon:"✉️",
        settings:{bg:"",padding:0,hideHeader:false,hideFooter:false},
        blocks:[
          { id:"co0", type:"text", tag:"h1", text:"Contattaci", align:"center", fontSize:28, fontWeight:"800", padding:16 },
          { id:"co1", type:"columns", cols:2, gap:16, cols_content:[
            [
              { id:"cf", type:"form", title:"Scrivici", storageKey:"contatti_msgs",
                submitLabel:"Invia", thankYou:"Grazie! Ti risponderemo al più presto.",
                fields:[
                  {key:"nome",label:"Nome",type:"text",required:true},
                  {key:"email",label:"Email",type:"email",required:true},
                  {key:"tel",label:"Telefono",type:"tel",required:false},
                  {key:"msg",label:"Messaggio",type:"textarea",required:true},
                ]},
            ],
            [
              { id:"ci", type:"contact-info", items:[
                {icon:"📍", label:"Indirizzo", value:"Via Roma 1, Milano"},
                {icon:"📞", label:"Telefono",  value:"+39 000 000 000"},
                {icon:"✉️", label:"Email",     value:"info@azienda.it"},
                {icon:"🕘", label:"Orari",     value:"Lun-Ven 9:00-18:00"},
              ]},
              { id:"cs", type:"social", size:34, align:"left", items:[
                {net:"linkedin", url:"https://linkedin.com"},
                {net:"instagram", url:"https://instagram.com"},
                {net:"facebook", url:"https://facebook.com"},
              ]},
              { id:"cm", type:"map", address:"Via Roma 1, Milano", height:220 }
            ]
          ]}
        ]}
    ]
  };

  let schema=null;
  function load(){ try{ schema=JSON.parse(localStorage.getItem(KEY)); }catch(e){} if(!schema) schema=JSON.parse(JSON.stringify(DEFAULT)); return schema; }
  function save(){ localStorage.setItem(KEY, JSON.stringify(schema)); }
  function reset(){ schema=JSON.parse(JSON.stringify(DEFAULT)); save(); }
  function replace(o){ schema=o; save(); }
  function get(){ return schema||load(); }
  function dataGet(k){ try{return JSON.parse(localStorage.getItem(DP+k)||'[]');}catch(e){return[]} }
  function dataSet(k,r){ localStorage.setItem(DP+k, JSON.stringify(r)); }
  function submGet(k){ try{return JSON.parse(localStorage.getItem(SP+k)||'[]');}catch(e){return[]} }
  function submSet(k,r){ localStorage.setItem(SP+k, JSON.stringify(r)); }
  function submAdd(k,r){ const a=submGet(k); a.push({...r, _ts: new Date().toISOString()}); submSet(k,a); }
  function uid(p){ return (p||'b_')+Math.random().toString(36).slice(2,8); }

  // ricerca ricorsiva di un blocco: ritorna {arr, index, page, container?}
  function walk(cb){
    for(const page of get().pages){
      for(let i=0;i<(page.blocks||[]).length;i++){
        cb(page.blocks, i, page, null);
        walkChildren(page.blocks[i], cb, page);
      }
    }
  }
  function walkChildren(b, cb, page){
    if(!b) return;
    if(b.type==='section' && Array.isArray(b.children)){
      for(let i=0;i<b.children.length;i++){ cb(b.children, i, page, b); walkChildren(b.children[i], cb, page); }
    }
    if(b.type==='columns' && Array.isArray(b.cols_content)){
      for(const col of b.cols_content) for(let i=0;i<col.length;i++){ cb(col, i, page, b); walkChildren(col[i], cb, page); }
    }
  }
  function findById(id){
    let out=null;
    walk((arr,i,page,container)=>{ if(arr[i].id===id) out={arr,index:i,page,container,block:arr[i]}; });
    return out;
  }
  function moveById(id, dir){ const f=findById(id); if(!f) return; const j=f.index+dir; if(j<0||j>=f.arr.length) return; [f.arr[f.index],f.arr[j]]=[f.arr[j],f.arr[f.index]]; save(); }
  function deleteById(id){ const f=findById(id); if(!f) return; f.arr.splice(f.index,1); save(); }

  window.RG = { load, save, reset, replace, get, dataGet, dataSet, submGet, submSet, submAdd, uid,
                findById, moveById, deleteById, DEFAULT };
  load();
})();
