// SCHEMA — struttura completa dell'app in un solo oggetto persistito.
(function(){
  const KEY = 'app-schema';
  const DATA_PREFIX = 'app-data:'; // per righe delle tabelle

  const DEFAULT = {
    brand: { name:"La mia azienda", logo:"" },
    theme: { primary:"#3B9FD4", bg:"#0b0f14", panel:"#141a22", panel2:"#1b232d",
             border:"#2a3441", text:"#e6edf3", muted:"#8a97a8", danger:"#d64545" },
    header: {
      show:true, bg:"", text:"", align:"left",
      logoPos:"left", logoSize:36,
      title:"App Aziendale", subtitle:"Sistema di gestione"
    },
    footer: { show:true, text:"© La mia azienda — v1.0" },
    pages: [
      { id:"home", name:"Home", icon:"🏠", blocks:[
        { id:"t_home_h", type:"text", tag:"h1", text:"Benvenuto",
          align:"center", color:"", fontSize:26, fontWeight:"800", padding:12 },
        { id:"t_home_s", type:"text", tag:"p", text:"Scegli un'azione qui sotto per iniziare.",
          align:"center", color:"", fontSize:14, fontWeight:"400", padding:0 },
        { id:"b_home", type:"buttons", layout:"stack", items:[
          { label:"📋 Vai alle pratiche", style:"primary", action:{type:"goto", page:"pratiche"} },
          { label:"📷 Nuova scansione",   style:"default", action:{type:"goto", page:"scan"} },
          { label:"ℹ️ Info azienda",       style:"ghost",   action:{type:"alert", text:"Contattaci: info@azienda.it"} },
        ]}
      ]},
      { id:"pratiche", name:"Pratiche", icon:"📋", blocks:[
        { id:"tbl_p", type:"table", title:"Elenco pratiche", storageKey:"pratiche",
          columns:[
            { key:"id",   label:"ID",       type:"text" },
            { key:"forn", label:"Fornitore",type:"text" },
            { key:"stato",label:"Stato",    type:"select", options:["Aperta","In lavorazione","Chiusa"] },
            { key:"data", label:"Data",     type:"date" }
          ],
          allowAdd:true, allowDelete:true, allowEdit:true, allowExport:true
        }
      ]},
      { id:"scan", name:"Scan", icon:"📷", blocks:[
        { id:"tbl_s", type:"table", title:"Codici scansionati", storageKey:"scan",
          columns:[
            { key:"codice", label:"Codice", type:"text" },
            { key:"note",   label:"Note",   type:"text" },
            { key:"ts",     label:"Data",   type:"datetime" }
          ],
          allowAdd:true, allowDelete:true, allowEdit:false, allowExport:true
        }
      ]}
    ]
  };

  let schema = null;
  function load(){
    try{ schema = JSON.parse(localStorage.getItem(KEY)); }catch(e){}
    if(!schema) schema = JSON.parse(JSON.stringify(DEFAULT));
    return schema;
  }
  function save(){ localStorage.setItem(KEY, JSON.stringify(schema)); }
  function reset(){ schema = JSON.parse(JSON.stringify(DEFAULT)); save(); }
  function replace(o){ schema = o; save(); }
  function get(){ return schema || load(); }

  // data (righe delle tabelle) — persistite separatamente per non gonfiare lo schema
  function dataGet(key){ try{ return JSON.parse(localStorage.getItem(DATA_PREFIX+key)||'[]'); }catch(e){ return []; } }
  function dataSet(key, rows){ localStorage.setItem(DATA_PREFIX+key, JSON.stringify(rows)); }

  function uid(prefix){ return (prefix||'b_') + Math.random().toString(36).slice(2,8); }

  window.RG = { load, save, reset, replace, get, dataGet, dataSet, uid, DEFAULT };
  load();
})();
