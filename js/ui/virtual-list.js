// js/ui/virtual-list.js — virtual scroll componente vanilla.
//
// Sostituisce il pattern attuale "renderList genera <div> per OGNI riga"
// (che diventa lento oltre ~1000 record) con: render solo delle righe
// visibili + un padder che dà al container l'altezza totale.
//
// Uso:
//   var vl = createVirtualList({
//     container: document.getElementById('lstArea'),
//     itemHeight: 84,          // px altezza fissa per riga
//     buffer: 5,               // righe extra sopra/sotto viewport
//     render: function(row, i){ var el = document.createElement('div'); ... ; return el; }
//   });
//   vl.setItems(rowsArray);    // ridisegna
//   vl.update();               // richiama render (es. dopo cambio ruolo)
//   vl.destroy();              // rimuove listener scroll
//
// Non richiede alcuna dipendenza. Testato solo per altezza riga FISSA:
// per righe di altezza variabile serve strategia diversa (measure-cache).
'use strict';

function createVirtualList(opts){
  var container = opts.container;
  var itemHeight = opts.itemHeight || 60;
  var buffer = opts.buffer != null ? opts.buffer : 5;
  var renderFn = opts.render;
  if(!container || typeof renderFn !== 'function'){
    throw new Error('virtual-list: container + render sono obbligatori');
  }

  // Contenitore interno: totale = items.length * itemHeight
  container.style.position = container.style.position || 'relative';
  container.style.overflowY = 'auto';

  var inner = document.createElement('div');
  inner.style.position = 'relative';
  inner.style.width = '100%';
  container.innerHTML = '';
  container.appendChild(inner);

  var items = [];
  var renderedRange = { start: -1, end: -1 };
  var pool = []; // elementi DOM riciclabili

  function _visibleRange(){
    var top = container.scrollTop;
    var h = container.clientHeight;
    var start = Math.floor(top / itemHeight) - buffer;
    var end = Math.ceil((top + h) / itemHeight) + buffer;
    if(start < 0) start = 0;
    if(end > items.length) end = items.length;
    return { start: start, end: end };
  }

  function _draw(){
    var r = _visibleRange();
    // ottimizzazione: se il range non è cambiato, skip
    if(r.start === renderedRange.start && r.end === renderedRange.end) return;
    renderedRange = r;

    // clear + ricrea range visibile
    inner.innerHTML = '';
    for(var i = r.start; i < r.end; i++){
      var el = renderFn(items[i], i);
      if(!el) continue;
      el.style.position = 'absolute';
      el.style.top = (i * itemHeight) + 'px';
      el.style.left = '0';
      el.style.right = '0';
      el.style.height = itemHeight + 'px';
      inner.appendChild(el);
    }
  }

  function _onScroll(){ _draw(); }

  container.addEventListener('scroll', _onScroll, { passive: true });

  function setItems(arr){
    items = Array.isArray(arr) ? arr : [];
    inner.style.height = (items.length * itemHeight) + 'px';
    renderedRange = { start: -1, end: -1 }; // forza redraw
    _draw();
  }

  function update(){
    renderedRange = { start: -1, end: -1 };
    _draw();
  }

  function destroy(){
    container.removeEventListener('scroll', _onScroll);
    container.innerHTML = '';
    items = [];
  }

  // Info utili per test
  function _debug(){
    return {
      itemsCount: items.length,
      range: renderedRange,
      innerHeight: inner.style.height,
      renderedNodes: inner.children.length
    };
  }

  return { setItems: setItems, update: update, destroy: destroy, _debug: _debug };
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = createVirtualList;
}
if(typeof window !== 'undefined'){
  window.createVirtualList = createVirtualList;
}
