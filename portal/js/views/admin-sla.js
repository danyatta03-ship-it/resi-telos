// Admin — configurazione delle soglie SLA per stato.

import { h, mount, clear, withBusy } from '../ui/dom.js';
import { getRole } from '../core/auth.js';
import { getSlaConfig, saveSlaConfig, loadSlaConfig, DEFAULT_SLA, configurableStates, formatHours } from '../domain/sla.js';
import { stateLabel, stateColor, stateIcon, STATE_META } from '../domain/workflow.js';
import { toast } from '../ui/toast.js';
import { confirmDialog } from '../ui/modal.js';
import { pageHeader, emptyState, banner } from '../ui/components.js';

export function renderAdminSla(container) {
  clear(container);

  if (getRole() !== 'ADMIN') {
    container.appendChild(emptyState({ icon: '⛔', title: 'Accesso negato', message: 'Sezione riservata agli amministratori.' }));
    return;
  }

  const zone = h('div');
  container.appendChild(pageHeader('Soglie SLA', 'Definisci entro quante ore lavorative una pratica deve lasciare ogni stato.'));
  container.appendChild(banner('info',
    'Le ore sono LAVORATIVE: lunedi'.concat('-venerdi 08:00-18:00. Un reso fermo dal venerdi sera risulta in ritardo solo dal lunedi mattina.')));
  container.appendChild(zone);

  loadSlaConfig().then(() => draw());

  function draw() {
    const config = getSlaConfig();
    const inputs = {};

    const cards = configurableStates().map((state) => {
      const cfg = config[state] || DEFAULT_SLA[state] || { warnHours: 0, critHours: 0 };
      const color = stateColor(state);

      const warnInput = h('input.input', { type: 'number', min: '0', step: '1', value: cfg.warnHours });
      const critInput = h('input.input', { type: 'number', min: '0', step: '1', value: cfg.critHours });
      const preview = h('div.dim', { style: { fontSize: '12px', marginTop: '6px' } });

      function updatePreview() {
        const w = Number(warnInput.value) || 0;
        const c = Number(critInput.value) || 0;
        preview.textContent = 'Avviso dopo ' + formatHours(w) + ' · critico dopo ' + formatHours(c) +
          (c < w ? '  ⚠ la soglia critica deve essere ≥ quella di avviso' : '');
        preview.style.color = c < w ? 'var(--warn)' : 'var(--text-3)';
      }
      warnInput.addEventListener('input', updatePreview);
      critInput.addEventListener('input', updatePreview);
      updatePreview();

      inputs[state] = { warnInput, critInput };

      return h('div.card', { style: { borderLeft: '3px solid ' + color } }, [
        h('div.row', { style: { marginBottom: '10px' } }, [
          h('span', { style: { fontSize: '17px' } }, stateIcon(state)),
          h('div', { style: { flex: '1 1 auto' } }, [
            h('div', { style: { fontWeight: '700', fontSize: '14.5px' } }, stateLabel(state)),
            h('div.dim', { style: { fontSize: '12px' } }, (STATE_META[state] && STATE_META[state].desc) || '')
          ])
        ]),
        h('div.grid.grid-2', [
          h('div', [h('label.label', 'Avviso (ore)'), warnInput]),
          h('div', [h('label.label', 'Critico (ore)'), critInput])
        ]),
        preview
      ]);
    });

    const saveBtn = h('button.btn.btn-primary.btn-lg', { type: 'button' }, 'Salva soglie');

    saveBtn.addEventListener('click', async () => {
      const next = {};
      for (const state in inputs) {
        const w = Math.max(0, Number(inputs[state].warnInput.value) || 0);
        const c = Math.max(0, Number(inputs[state].critInput.value) || 0);
        if (c < w) {
          toast('In "' + stateLabel(state) + '" la soglia critica deve essere maggiore o uguale a quella di avviso.', 'err');
          return;
        }
        next[state] = { warnHours: w, critHours: c };
      }
      await withBusy(saveBtn, async () => {
        try {
          await saveSlaConfig(next);
          toast('Soglie SLA salvate', 'ok');
        } catch (err) {
          toast(err.message || 'Salvataggio non riuscito.', 'err');
        }
      });
    });

    const resetBtn = h('button.btn', {
      type: 'button',
      onclick: async () => {
        const yes = await confirmDialog({
          title: 'Ripristina default',
          message: 'Tutte le soglie tornano ai valori di fabbrica. Confermi?',
          confirmLabel: 'Ripristina'
        });
        if (!yes) return;
        await saveSlaConfig(DEFAULT_SLA);
        toast('Soglie ripristinate', 'ok');
        draw();
      }
    }, 'Ripristina default');

    mount(zone, [
      h('div.grid.grid-auto', { style: { marginBottom: '20px' } }, cards),
      h('div.row.gap-2', [saveBtn, resetBtn])
    ]);
  }
}
