(function (root) {
  'use strict';

  const categories = [
    { key: 'love', label: 'What you love' },
    { key: 'strength', label: 'What you are good at' },
    { key: 'opportunity', label: 'What you can be paid for' },
    { key: 'need', label: 'What the world needs' }
  ];

  const modes = {
    deep: {
      label: 'Deep',
      option: 'Write your own',
      description: 'Write three activities per category. Two rounds.',
      source: 'own',
      itemsPerCategory: 3,
      roundCount: 2
    },
    quick: {
      label: 'Quick',
      option: 'Choose from the deck',
      description: 'Pick three activities per category. One round.',
      source: 'premade',
      itemsPerCategory: 3,
      roundCount: 1
    },
    custom: {
      label: 'Custom',
      option: 'Custom',
      description: 'Set up your own card mix.',
      source: 'premade',
      itemsPerCategory: 3,
      roundCount: 2
    }
  };

  const esc = value => String(value || '').replace(/[&<>'"]/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));

  function settingsMarkup(prefix) {
    const modeOptions = Object.entries(modes).map(([key, mode]) =>
      `<option value="${key}" ${key === 'quick' ? 'selected' : ''}>${mode.option}</option>`
    ).join('');
    return `<label class="field-label" for="${prefix}-mode">Activity cards</label><select id="${prefix}-mode">${modeOptions}</select><p class="helper" id="${prefix}-mode-description">${modes.quick.description}</p><div id="${prefix}-custom-options" hidden><label class="field-label" for="${prefix}-source">Activity source</label><select id="${prefix}-source"><option value="premade">Pre-made cards</option><option value="own">Write your own</option></select><div class="config-grid"><label>Items per category<input id="${prefix}-items" type="number" min="1" max="8" value="${modes.custom.itemsPerCategory}"></label><label>Table rounds<input id="${prefix}-rounds" type="number" min="1" max="24" value="${modes.custom.roundCount}"></label></div><p class="field-label">Cards in each turn prompt</p><div class="config-grid category-counts">${categories.map(({key, label}) => `<label>${label}<input id="${prefix}-count-${key}" type="number" min="0" max="8" value="1"></label>`).join('')}</div></div>`;
  }

  function syncModeForm(prefix) {
    const mode = document.getElementById(`${prefix}-mode`)?.value;
    const custom = document.getElementById(`${prefix}-custom-options`);
    const description = document.getElementById(`${prefix}-mode-description`);
    if (custom) custom.hidden = mode !== 'custom';
    if (description && modes[mode]) description.textContent = modes[mode].description;
  }

  function readSettings(prefix) {
    const mode = document.getElementById(`${prefix}-mode`)?.value;
    const preset = modes[mode];
    if (!preset) return null;
    const isCustom = mode === 'custom';
    return {
      mode,
      source: isCustom ? document.getElementById(`${prefix}-source`)?.value : preset.source,
      itemsPerCategory: isCustom ? Number(document.getElementById(`${prefix}-items`)?.value) : preset.itemsPerCategory,
      roundCount: isCustom ? Number(document.getElementById(`${prefix}-rounds`)?.value) : preset.roundCount,
      roundCardCounts: Object.fromEntries(categories.map(({key}) => [
        key,
        isCustom ? Number(document.getElementById(`${prefix}-count-${key}`)?.value) : 1
      ]))
    };
  }

  function validateSettings(config) {
    if (!config || !modes[config.mode] || !['own', 'premade'].includes(config.source)) return 'Choose a valid game mode.';
    if (!Number.isInteger(config.itemsPerCategory) || config.itemsPerCategory < 1 || config.itemsPerCategory > 8) return 'Choose 1–8 activities per category.';
    if (!Number.isInteger(config.roundCount) || config.roundCount < 1 || config.roundCount > 24) return 'Choose 1–24 table rounds.';
    const counts = categories.map(({key}) => config.roundCardCounts?.[key]);
    if (counts.some(count => !Number.isInteger(count) || count < 0 || count > config.itemsPerCategory) || !counts.some(count => count > 0)) {
      return 'Choose at least one prompt card overall, with no category using more than its available activities.';
    }
    return null;
  }

  function activeCategories(config) {
    return categories.filter(({key}) => Number(config?.roundCardCounts?.[key]) > 0);
  }

  function countLabel(count, singular, plural) {
    const fallbackPlural = /[^aeiou]y$/i.test(singular) ? `${singular.slice(0, -1)}ies` : `${singular}s`;
    return `${count} ${count === 1 ? singular : (plural || fallbackPlural)}`;
  }

  function configSummary(config) {
    const mode = modes[config.mode] || modes.custom;
    const source = config.source === 'own' ? 'Self-generated' : 'Pre-made';
    const prompt = activeCategories(config).map(({key, label}) => `${label}: ${config.roundCardCounts[key]}`).join(' · ');
    return `${countLabel(config.roundCount, 'round')} · ${config.source === 'own' ? 'Your own activities' : 'Cards from the deck'}`;
  }

  function categoryStrip() {
    return `<div class="category-strip">${categories.map(({key, label}, index) => `<div class="${key}"><b>${label}</b></div>`).join('')}</div>`;
  }

  function notify(message) {
    document.querySelectorAll('.toast').forEach(node => node.remove());
    const node = document.createElement('div');
    node.className = 'toast';
    node.setAttribute('role', 'status');
    node.textContent = message;
    document.body.append(node);
    setTimeout(() => node.remove(), 2400);
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {
        // Some browsers expose the API but block it outside a secure context.
      }
    }
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;left:-9999px;opacity:0';
    document.body.append(area);
    area.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
    area.remove();
    return copied;
  }

  root.IKIGAI_GAME = Object.freeze({
    categories: Object.freeze(categories),
    modes: Object.freeze(modes),
    esc,
    settingsMarkup,
    syncModeForm,
    readSettings,
    validateSettings,
    activeCategories,
    countLabel,
    configSummary,
    categoryStrip,
    notify,
    copyText
  });
}(window));
