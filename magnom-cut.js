/* MAGNOMEDITS — CapCut-like photo + video editor */

let cutObjectUrl = null;
let cutImportedFile = null;
let cutDuration = 0;
let cutMediaKind = null; // 'video' | 'image'
let cutAudioBound = false;
let cutHistory = [];
let cutHistoryIndex = -1;
let cutHistoryLock = false;
let cutRaf = null;
let cutAudioCtx = null;
let cutMusicNodes = null;
let cutMusicTimer = null;
let cutDragTarget = null;
let cutDragOffset = { x: 0, y: 0 };

const CUT_FILTER_MAP = window.CUT_FILTER_MAP || { none: '' };

const CUT_DEFAULT_STATE = () => ({
    filter: 'none',
    textStyle: 'gold',
    sticker: '',
    effect: 'none',
    music: 'none',
    ratio: '9x16',
    fit: 'contain',
    bright: 1,
    contrast: 1,
    saturate: 1,
    speed: 1,
    trimStart: 0,
    trimEnd: 0,
    musicVol: 0.35,
    videoVol: 1,
    photoDuration: 8,
    flipX: false,
    rotate: 0,
    captionX: 50,
    captionY: 82,
    stickerX: 82,
    stickerY: 16,
    captionText: '',
});

let cutState = CUT_DEFAULT_STATE();

function cutMusicById(id) {
    return (window.CUT_MUSIC_CATALOG || []).find((m) => m.id === id) || null;
}

function cutEffectById(id) {
    return (window.CUT_EFFECT_CATALOG || []).find((e) => e.id === id) || { id: 'none', kind: 'none' };
}

function populateMagnomCutLibrary() {
    const musicHost = document.getElementById('cutMusicChips');
    if (musicHost) {
        musicHost.innerHTML = (window.CUT_MUSIC_CATALOG || []).map((m) =>
            `<button type="button" class="capcut-chip${m.id === 'none' ? ' active' : ''}" data-music="${m.id}">${m.name}</button>`
        ).join('');
    }
    const fxHost = document.getElementById('cutEffects');
    if (fxHost) {
        fxHost.innerHTML = (window.CUT_EFFECT_CATALOG || []).map((e) =>
            `<button type="button" class="capcut-chip${e.id === 'none' ? ' active' : ''}" data-fx="${e.id}">${e.name}</button>`
        ).join('');
    }
    const filterHost = document.getElementById('cutFilters');
    if (filterHost) {
        filterHost.innerHTML = (window.CUT_FILTER_CATALOG || []).map((f) =>
            `<button type="button" class="capcut-chip gold-active${f.id === 'none' ? ' active' : ''}" data-filter="${f.id}">${f.name}</button>`
        ).join('');
    }
    const stickerHost = document.getElementById('cutStickers');
    if (stickerHost) {
        stickerHost.innerHTML = (window.CUT_STICKER_CATALOG || []).map((s) =>
            `<button type="button" data-sticker="${s}">${s || '✖'}</button>`
        ).join('');
    }
    const styleHost = document.getElementById('cutTextStyles');
    if (styleHost) {
        styleHost.innerHTML = (window.CUT_TEXT_STYLE_CATALOG || []).map((s) =>
            `<button type="button" class="capcut-chip${s.id === 'gold' ? ' active' : ''}" data-style="${s.id}">${s.name}</button>`
        ).join('');
    }
    const presetHost = document.getElementById('cutCaptionPresets');
    if (presetHost) {
        presetHost.innerHTML = (window.CUT_CAPTION_PRESETS || []).map((p) =>
            `<button type="button" class="capcut-chip" onclick="setCutCaptionPreset('${p.replace(/'/g, "\\'")}')">${p}</button>`
        ).join('');
    }
    const templateHost = document.getElementById('cutTemplateGrid');
    if (templateHost) {
        renderMagnomCutTemplates();
        const search = document.getElementById('cutTemplateSearch');
        search?.addEventListener('input', () => renderMagnomCutTemplates());
    }
    const counts = document.getElementById('cutLibraryCounts');
    if (counts) {
        const m = (window.CUT_MUSIC_CATALOG || []).length - 1;
        const e = (window.CUT_EFFECT_CATALOG || []).length - 1;
        const f = (window.CUT_FILTER_CATALOG || []).length - 1;
        const s = (window.CUT_STICKER_CATALOG || []).length - 1;
        const tpl = (window.CUT_TEMPLATE_CATALOG || []).length;
        counts.textContent = `${tpl} templates · ${m}+ sounds · ${e}+ effects · ${f}+ filters · ${s}+ stickers`;
    }
}

let cutTemplateTab = 'foryou';
let cutTemplateCat = 'All';

function formatCutUses(n) {
    if (!Number.isFinite(n)) return '';
    if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K uses`;
    return `${n} uses`;
}

function cutTemplateCardHtml(t) {
    const badge = t.badge
        ? `<span class="capcut-template-badge ${String(t.badge).toLowerCase()}">${t.badge}</span>`
        : '';
    return `
      <button type="button" class="capcut-template-card" data-template="${t.id}" data-cat="${t.cat}" onclick="applyMagnomCutTemplate('${t.id}')">
        <span class="capcut-template-cover" style="background-image:${t.cover}"></span>
        ${badge}
        <span class="capcut-template-body">
          <span class="capcut-template-name">${t.name}</span>
          <span class="capcut-template-meta">
            <span>${t.cat}</span>
            <span>${t.duration || 8}s · ${formatCutUses(t.uses)}</span>
          </span>
          <span class="capcut-template-use">Use</span>
        </span>
      </button>`;
}

function getFilteredMagnomTemplates() {
    const q = (document.getElementById('cutTemplateSearch')?.value || '').trim().toLowerCase();
    return (window.CUT_TEMPLATE_CATALOG || []).filter((t) => {
        if (cutTemplateTab === 'trending' && !t.trending) return false;
        if (cutTemplateTab === 'new' && t.badge !== 'New' && t.badge !== 'Hot') return false;
        if (cutTemplateTab === 'foryou' && !t.forYou) return false;
        if (cutTemplateCat !== 'All' && t.cat !== cutTemplateCat) return false;
        if (q) {
            const hay = `${t.name} ${t.cat} ${t.caption || ''} ${t.filter || ''} ${t.music || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    });
}

function renderMagnomCutTemplates() {
    const list = getFilteredMagnomTemplates();
    const grid = document.getElementById('cutTemplateGrid');
    const rail = document.getElementById('cutTemplateRail');
    const countEl = document.getElementById('cutTemplateCount');
    if (countEl) countEl.textContent = String((window.CUT_TEMPLATE_CATALOG || []).length);

    const tabsHost = document.getElementById('cutTemplateTabs');
    if (tabsHost && !tabsHost.dataset.ready) {
        tabsHost.innerHTML = (window.CUT_TEMPLATE_TABS || [
            { id: 'foryou', name: 'For you' },
            { id: 'trending', name: 'Trending' },
            { id: 'new', name: 'New' },
            { id: 'all', name: 'All' },
        ]).map((tab) =>
            `<button type="button" class="capcut-template-tab${tab.id === cutTemplateTab ? ' active' : ''}" data-tab="${tab.id}" onclick="setMagnomTemplateTab('${tab.id}')">${tab.name}</button>`
        ).join('');
        tabsHost.dataset.ready = '1';
    } else if (tabsHost) {
        tabsHost.querySelectorAll('.capcut-template-tab').forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.tab === cutTemplateTab);
        });
    }

    const cats = ['All', ...new Set((window.CUT_TEMPLATE_CATALOG || []).map((t) => t.cat))];
    const filterHost = document.getElementById('cutTemplateFilters');
    if (filterHost) {
        filterHost.innerHTML = cats.map((c) =>
            `<button type="button" class="capcut-chip${c === cutTemplateCat ? ' active' : ''}" data-template-cat="${c}" onclick="filterMagnomCutTemplates('${c}')">${c}</button>`
        ).join('');
    }

    if (rail) {
        const trending = (window.CUT_TEMPLATE_CATALOG || []).filter((t) => t.trending).slice(0, 10);
        rail.innerHTML = trending.map(cutTemplateCardHtml).join('');
        rail.style.display = cutTemplateTab === 'all' || cutTemplateTab === 'foryou' ? '' : 'none';
    }
    if (grid) {
        grid.innerHTML = list.length
            ? list.map(cutTemplateCardHtml).join('')
            : `<div class="capcut-val" style="grid-column:1/-1;color:var(--cc-muted)">No templates found</div>`;
    }
}

function setMagnomTemplateTab(tab) {
    cutTemplateTab = tab || 'foryou';
    renderMagnomCutTemplates();
}


function isCutImageFile(file) {
    if (!file) return false;
    if (file.type?.startsWith('image/')) return true;
    return /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(file.name || '');
}

function isCutVideoFile(file) {
    if (!file) return false;
    if (file.type?.startsWith('video/')) return true;
    return /\.(mp4|webm|mov|m4v|avi|mkv)$/i.test(file.name || '');
}

function cutNeedMediaMsg() {
    return typeof tx === 'function' ? tx('cut.needMedia') : 'Import an image or video first';
}

function setCutStatus(msg) {
    const el = document.getElementById('cutStatus');
    if (el) el.textContent = msg;
}

function formatCutTime(sec) {
    if (!Number.isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

function getCutPreviewEl() {
    if (cutMediaKind === 'image') return document.getElementById('cutImagePreview');
    return document.getElementById('cutPreview');
}

function cloneCutState(extra) {
    return Object.assign({}, cutState, extra || {});
}

function pushCutHistory() {
    if (cutHistoryLock) return;
    const snap = JSON.stringify(cloneCutState());
    if (cutHistoryIndex >= 0 && cutHistory[cutHistoryIndex] === snap) return;
    cutHistory = cutHistory.slice(0, cutHistoryIndex + 1);
    cutHistory.push(snap);
    if (cutHistory.length > 40) cutHistory.shift();
    cutHistoryIndex = cutHistory.length - 1;
    updateCutHistoryButtons();
}

function updateCutHistoryButtons() {
    const undo = document.getElementById('cutUndoBtn');
    const redo = document.getElementById('cutRedoBtn');
    if (undo) undo.disabled = cutHistoryIndex <= 0;
    if (redo) redo.disabled = cutHistoryIndex < 0 || cutHistoryIndex >= cutHistory.length - 1;
}

function applyCutHistorySnapshot(snap) {
    cutHistoryLock = true;
    try {
        cutState = Object.assign(CUT_DEFAULT_STATE(), JSON.parse(snap));
        const caption = document.getElementById('cutCaption');
        if (caption) caption.value = cutState.captionText || '';
        syncControlsFromState();
        applyAllCutVisuals();
    } finally {
        cutHistoryLock = false;
    }
    updateCutHistoryButtons();
}

function cutUndo() {
    if (cutHistoryIndex <= 0) return;
    cutHistoryIndex -= 1;
    applyCutHistorySnapshot(cutHistory[cutHistoryIndex]);
}

function cutRedo() {
    if (cutHistoryIndex >= cutHistory.length - 1) return;
    cutHistoryIndex += 1;
    applyCutHistorySnapshot(cutHistory[cutHistoryIndex]);
}

function syncControlsFromState() {
    const map = [
        ['cutBright', 'bright'],
        ['cutContrast', 'contrast'],
        ['cutSaturate', 'saturate'],
        ['cutSpeed', 'speed'],
        ['cutMusicVol', 'musicVol'],
        ['cutVideoVol', 'videoVol'],
        ['cutPhotoDuration', 'photoDuration'],
        ['cutTrimStart', 'trimStart'],
        ['cutTrimEnd', 'trimEnd'],
    ];
    map.forEach(([id, key]) => {
        const el = document.getElementById(id);
        if (el) el.value = String(cutState[key]);
    });
    const pdv = document.getElementById('cutPhotoDurationVal');
    if (pdv) pdv.textContent = `${Math.round(cutState.photoDuration || 8)}s`;
    document.querySelectorAll('#cutFilters .capcut-chip').forEach((c) => {
        c.classList.toggle('active', c.dataset.filter === cutState.filter);
    });
    document.querySelectorAll('#cutTextStyles .capcut-chip').forEach((c) => {
        c.classList.toggle('active', c.dataset.style === cutState.textStyle);
    });
    document.querySelectorAll('#cutEffects .capcut-chip').forEach((c) => {
        c.classList.toggle('active', c.dataset.fx === cutState.effect);
    });
    document.querySelectorAll('#cutMusicChips .capcut-chip').forEach((c) => {
        c.classList.toggle('active', c.dataset.music === cutState.music);
    });
    document.querySelectorAll('#cutRatios .capcut-chip').forEach((c) => {
        c.classList.toggle('active', c.dataset.ratio === cutState.ratio);
    });
    document.querySelectorAll('#cutFitModes .capcut-chip').forEach((c) => {
        c.classList.toggle('active', c.dataset.fit === cutState.fit);
    });
    applyCutAdjustLabels();
    applyCutSpeed();
    applyCutVolumes();
    updateCutTrimUI();
    syncCutModeUI();
}

function applyCutAdjustLabels() {
    const bv = document.getElementById('cutBrightVal');
    const cv = document.getElementById('cutContrastVal');
    const sv = document.getElementById('cutSaturateVal');
    if (bv) bv.textContent = cutState.bright.toFixed(2);
    if (cv) cv.textContent = cutState.contrast.toFixed(2);
    if (sv) sv.textContent = cutState.saturate.toFixed(2);
}

function hideCutEmpty() {
    const hint = document.getElementById('cutEmptyHint');
    if (!hint) return;
    hint.classList.add('is-hidden', 'hidden');
    hint.style.display = 'none';
    hint.setAttribute('aria-hidden', 'true');
}

function showCutEmpty() {
    const hint = document.getElementById('cutEmptyHint');
    if (!hint) return;
    hint.classList.remove('is-hidden', 'hidden');
    hint.style.display = 'grid';
    hint.removeAttribute('aria-hidden');
}

function showCutMediaEl(el, show) {
    if (!el) return;
    el.classList.toggle('is-shown', !!show);
    if (show) {
        el.removeAttribute('hidden');
        el.style.setProperty('display', 'block', 'important');
        el.style.setProperty('visibility', 'visible', 'important');
        el.style.setProperty('opacity', '1', 'important');
        el.style.position = 'absolute';
        el.style.inset = '0';
        el.style.width = '100%';
        el.style.height = '100%';
        el.style.zIndex = '1';
        el.style.background = '#000';
    } else {
        el.setAttribute('hidden', '');
        el.style.setProperty('display', 'none', 'important');
        el.classList.remove('is-shown');
    }
}

function syncCutModeUI() {
    const studio = document.getElementById('magnomCutStudio');
    if (studio) {
        studio.dataset.media = cutMediaKind || '';
        studio.classList.toggle('is-image', cutMediaKind === 'image');
        studio.classList.toggle('is-video', cutMediaKind === 'video');
    }
    const video = document.getElementById('cutPreview');
    const image = document.getElementById('cutImagePreview');
    showCutMediaEl(video, cutMediaKind === 'video');
    showCutMediaEl(image, cutMediaKind === 'image');

    document.querySelectorAll('#capcutDock .capcut-dock-btn').forEach((btn) => {
        const videoOnly = btn.dataset.videoOnly === '1';
        btn.disabled = cutMediaKind === 'image' && videoOnly;
        btn.classList.toggle('disabled', btn.disabled);
    });
    const playTop = document.getElementById('cutPlayBtn');
    // Photos can still preview music via Play
    if (playTop) playTop.style.display = '';
    const videoAudioWrap = document.getElementById('cutVideoAudioWrap');
    const photoDurWrap = document.getElementById('cutPhotoDurationWrap');
    if (videoAudioWrap) videoAudioWrap.style.display = cutMediaKind === 'image' ? 'none' : '';
    if (photoDurWrap) photoDurWrap.style.display = cutMediaKind === 'image' ? '' : 'none';
}

function openCapcutPanel(name) {
    if (cutMediaKind === 'image' && (name === 'speed' || name === 'trim')) {
        name = 'media';
        setCutStatus(typeof tx === 'function' ? tx('cut.imageModeHint') : 'Speed and trim are for videos. Use Audio for photo music.');
    }
    document.querySelectorAll('#capcutDock .capcut-dock-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.panel === name);
    });
    document.querySelectorAll('.capcut-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.dataset.panel === name);
    });
    const title = document.getElementById('capcutSideTitle');
    const labels = {
        media: 'Media',
        templates: 'Templates',
        audio: 'Audio',
        text: 'Text',
        stickers: 'Stickers',
        effects: 'Effects',
        filters: 'Filters',
        adjust: 'Adjust',
        canvas: 'Canvas',
        speed: 'Speed',
        trim: 'Trim',
        export: 'Export',
    };
    if (title) title.textContent = labels[name] || (name.charAt(0).toUpperCase() + name.slice(1));
}

function applyCutMediaTransform() {
    const media = [document.getElementById('cutPreview'), document.getElementById('cutImagePreview')];
    const sx = cutState.flipX ? -1 : 1;
    const rot = cutState.rotate || 0;
    media.forEach((el) => {
        if (!el) return;
        el.style.transform = `scaleX(${sx}) rotate(${rot}deg)`;
        const fit = cutState.fit === 'cover' ? 'cover' : cutState.fit === 'fill' ? 'fill' : 'contain';
        el.style.objectFit = fit;
    });
}

function applyCutVisuals() {
    const targets = [
        document.getElementById('cutPreview'),
        document.getElementById('cutImagePreview'),
    ].filter(Boolean);
    const base = CUT_FILTER_MAP[cutState.filter] || '';
    const adj = `brightness(${cutState.bright}) contrast(${cutState.contrast}) saturate(${cutState.saturate})`;
    const filterCss = `${base} ${adj}`.trim();
    targets.forEach((el) => {
        el.style.filter = filterCss;
        el.classList.add('capcut-filter-preview');
    });
    applyCutMediaTransform();
}

function applyCutCaption() {
    const overlay = document.getElementById('cutCaptionOverlay');
    const text = document.getElementById('cutCaption')?.value.trim() || '';
    cutState.captionText = text;
    if (!overlay) return;
    overlay.textContent = text;
    overlay.className = `capcut-text-overlay s-${cutState.textStyle}` + (text ? ' on' : '');
    overlay.style.left = `${cutState.captionX}%`;
    overlay.style.top = `${cutState.captionY}%`;
    overlay.style.bottom = 'auto';
    overlay.style.transform = 'translate(-50%, -50%)';
}

function applyCutSticker() {
    const el = document.getElementById('cutStickerOverlay');
    if (!el) return;
    el.textContent = cutState.sticker || '';
    el.classList.toggle('on', !!cutState.sticker);
    el.style.left = `${cutState.stickerX}%`;
    el.style.top = `${cutState.stickerY}%`;
    el.style.right = 'auto';
    el.style.transform = 'translate(-50%, -50%)';
}

function applyCutSpeed() {
    const video = document.getElementById('cutPreview');
    const label = document.getElementById('cutSpeedVal');
    if (label) label.textContent = `${Number(cutState.speed).toFixed(2)}x`;
    if (video && cutMediaKind === 'video') video.playbackRate = cutState.speed;
}

function applyCutVolumes() {
    const video = document.getElementById('cutPreview');
    if (video && cutMediaKind === 'video') video.volume = cutState.videoVol;
    const mv = document.getElementById('cutMusicVolVal');
    const vv = document.getElementById('cutVideoVolVal');
    if (mv) mv.textContent = `${Math.round(cutState.musicVol * 100)}%`;
    if (vv) vv.textContent = `${Math.round(cutState.videoVol * 100)}%`;
}

function applyCutRatio() {
    const inner = document.getElementById('cutPreviewInner');
    if (!inner) return;
    inner.className = `capcut-preview-inner ratio-${cutState.ratio}`;
}

function applyAllCutVisuals() {
    applyCutVisuals();
    applyCutCaption();
    applyCutSticker();
    applyCutSpeed();
    applyCutVolumes();
    applyCutRatio();
    updateCutTrimUI();
    updateTimelineLabels();
}

function setCutSpeed(v) {
    if (cutMediaKind === 'image') return;
    const input = document.getElementById('cutSpeed');
    if (input) input.value = String(v);
    cutState.speed = Number(v);
    applyCutSpeed();
    pushCutHistory();
}

function setCutFit(mode) {
    cutState.fit = mode === 'cover' || mode === 'fill' ? mode : 'contain';
    document.querySelectorAll('#cutFitModes .capcut-chip').forEach((c) => {
        c.classList.toggle('active', c.dataset.fit === cutState.fit);
    });
    applyCutMediaTransform();
    pushCutHistory();
}

function cutFlip() {
    if (!cutMediaKind) {
        notify(cutNeedMediaMsg(), true);
        return;
    }
    cutState.flipX = !cutState.flipX;
    applyCutMediaTransform();
    pushCutHistory();
}

function cutRotate() {
    if (!cutMediaKind) {
        notify(cutNeedMediaMsg(), true);
        return;
    }
    cutState.rotate = ((cutState.rotate || 0) + 90) % 360;
    applyCutMediaTransform();
    pushCutHistory();
}

function setCutCaptionPreset(text) {
    const input = document.getElementById('cutCaption');
    if (input) input.value = text;
    applyCutCaption();
    pushCutHistory();
}

function filterMagnomCutTemplates(cat) {
    cutTemplateCat = cat || 'All';
    renderMagnomCutTemplates();
}

function applyMagnomCutTemplate(id) {
    const tpl = (window.CUT_TEMPLATE_CATALOG || []).find((t) => t.id === id);
    if (!tpl) {
        notify('Template not found', true);
        return;
    }
    if (!cutImportedFile) {
        notify(cutNeedMediaMsg(), true);
        openCapcutPanel('media');
        return;
    }

    cutState.filter = tpl.filter || 'none';
    cutState.effect = tpl.effect || 'none';
    cutState.music = tpl.music || 'none';
    cutState.textStyle = tpl.textStyle || 'gold';
    cutState.sticker = '';
    cutState.bright = tpl.bright ?? 1;
    cutState.contrast = tpl.contrast ?? 1;
    cutState.saturate = tpl.saturate ?? 1;
    cutState.ratio = tpl.ratio || cutState.ratio || '9x16';
    cutState.fit = tpl.fit || cutState.fit || 'contain';
    cutState.photoDuration = tpl.photoDuration || cutState.photoDuration || 8;
    cutState.captionX = 50;
    cutState.captionY = 82;
    cutState.stickerX = 82;
    cutState.stickerY = 16;

    const caption = document.getElementById('cutCaption');
    if (caption) caption.value = tpl.caption || '';
    cutState.captionText = tpl.caption || '';

    const project = document.getElementById('cutProjectName');
    if (project && !project.value.trim()) project.value = tpl.name;

    syncControlsFromState();
    applyAllCutVisuals();
    document.querySelectorAll('#cutTemplateGrid .capcut-template-card, #cutTemplateRail .capcut-template-card').forEach((c) => {
        c.classList.toggle('active', c.dataset.template === id);
    });
    pushCutHistory();
    setCutStatus(`Template applied: ${tpl.name}`);
    notify(`Template: ${tpl.name}`);

    if (tpl.effect && tpl.effect !== 'none') {
        setTimeout(() => previewCutEffect(), 40);
    }
    if (tpl.music && tpl.music !== 'none') {
        startCutMusic();
    } else {
        stopCutMusic();
    }
    openCapcutPanel('templates');
}

function updateTimelineLabels() {
    const videoTrack = document.getElementById('cutTrackVideoLabel');
    const overlayTrack = document.getElementById('cutTrackOverlayLabel');
    const audioTrack = document.getElementById('cutTrackAudioLabel');
    if (videoTrack) {
        if (cutMediaKind === 'image') videoTrack.textContent = 'Photo';
        else if (cutMediaKind === 'video') videoTrack.textContent = 'Video';
        else videoTrack.textContent = 'Video / Photo';
    }
    if (overlayTrack) {
        const bits = [];
        if (cutState.captionText) bits.push('Text');
        if (cutState.sticker) bits.push('Sticker');
        overlayTrack.textContent = bits.length ? bits.join(' + ') : 'Overlay';
    }
    if (audioTrack) {
        audioTrack.textContent = cutState.music !== 'none' ? `Audio · ${cutState.music}` : 'Audio';
    }
}

function updateCutTrimUI() {
    const startLabel = document.getElementById('cutTrimStartVal');
    const endLabel = document.getElementById('cutTrimEndVal');
    if (startLabel) startLabel.textContent = `${Number(cutState.trimStart).toFixed(1)}s`;
    if (endLabel) endLabel.textContent = `${Number(cutState.trimEnd).toFixed(1)}s`;
    const range = document.getElementById('cutTrimRange');
    if (range && cutDuration > 0 && cutMediaKind === 'video') {
        const left = (cutState.trimStart / cutDuration) * 100;
        const right = 100 - (cutState.trimEnd / cutDuration) * 100;
        range.style.left = `${Math.max(0, left)}%`;
        range.style.right = `${Math.max(0, right)}%`;
    } else if (range) {
        range.style.left = '0%';
        range.style.right = '0%';
    }
}

function applyCutTrimToPlayhead() {
    if (cutMediaKind !== 'video') return;
    const video = document.getElementById('cutPreview');
    if (video) video.currentTime = cutState.trimStart;
}

function syncCutTransport() {
    const video = document.getElementById('cutPreview');
    if (!video || cutMediaKind !== 'video') return;
    if (video.currentTime < cutState.trimStart) video.currentTime = cutState.trimStart;
    if (cutState.trimEnd > 0 && video.currentTime > cutState.trimEnd) {
        video.pause();
        video.currentTime = cutState.trimStart;
        stopCutMusic();
    }
    const label = document.getElementById('cutTimeLabel');
    if (label) label.textContent = `${formatCutTime(video.currentTime)} / ${formatCutTime(cutDuration)}`;
    const head = document.getElementById('cutPlayhead');
    if (head && cutDuration > 0) {
        head.style.left = `${(video.currentTime / cutDuration) * 100}%`;
    }
    cutRaf = requestAnimationFrame(syncCutTransport);
}

function clearInactiveMediaSrc(kindKeeping) {
    if (kindKeeping !== 'image') {
        const image = document.getElementById('cutImagePreview');
        if (image) {
            image.classList.remove('is-shown');
            image.style.display = 'none';
            image.setAttribute('hidden', '');
            image.removeAttribute('src');
            image.onload = null;
            image.onerror = null;
        }
    }
    if (kindKeeping !== 'video') {
        const video = document.getElementById('cutPreview');
        if (video) {
            try { video.pause(); } catch (_) {}
            video.classList.remove('is-shown');
            video.style.display = 'none';
            video.setAttribute('hidden', '');
            video.removeAttribute('src');
            try { video.load(); } catch (_) {}
            video.onloadedmetadata = null;
        }
    }
}

function handleCutImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const asImage = isCutImageFile(file);
    const asVideo = isCutVideoFile(file);
    if (!asImage && !asVideo) {
        notify(typeof tx === 'function' ? tx('cut.badFile') : 'Use an image (JPG/PNG/WebP) or video (MP4/WebM/MOV)', true);
        e.target.value = '';
        return;
    }

    if (cutObjectUrl) URL.revokeObjectURL(cutObjectUrl);
    stopCutMusic();
    cancelAnimationFrame(cutRaf);
    cutImportedFile = file;
    cutObjectUrl = URL.createObjectURL(file);
    cutMediaKind = asImage ? 'image' : 'video';
    cutDuration = 0;
    cutAudioBound = false;
    cutState = CUT_DEFAULT_STATE();
    cutHistory = [];
    cutHistoryIndex = -1;

    const nameEl = document.getElementById('cutMediaName');
    if (nameEl) nameEl.textContent = `${file.name} · ${cutMediaKind}`;
    const project = document.getElementById('cutProjectName');
    if (project && !project.value.trim()) {
        project.value = file.name.replace(/\.[^.]+$/, '');
    }
    hideCutEmpty();
    clearInactiveMediaSrc(cutMediaKind);

    if (cutMediaKind === 'image') {
        const image = document.getElementById('cutImagePreview');
        if (image) {
            image.onload = () => {
                const label = document.getElementById('cutTimeLabel');
                if (label) label.textContent = 'IMAGE';
                const head = document.getElementById('cutPlayhead');
                if (head) head.style.left = '0%';
                updateCutTrimUI();
                applyCutVisuals();
                hideCutEmpty();
            };
            image.onerror = () => {
                setCutStatus(typeof tx === 'function' ? tx('cut.loadFailImage') : 'Could not load this image. Try JPG or PNG.');
                notify(typeof tx === 'function' ? tx('cut.loadFailImage') : 'Could not load this image. Try JPG or PNG.', true);
                showCutEmpty();
            };
            image.classList.add('capcut-media', 'capcut-filter-preview');
            showCutMediaEl(image, true);
            image.style.objectFit = cutState.fit === 'cover' ? 'cover' : cutState.fit === 'fill' ? 'fill' : 'contain';
            image.src = cutObjectUrl;
        }
        syncCutModeUI();
        setCutStatus(typeof tx === 'function' ? tx('cut.readyImage') : 'Image imported — edit with MAGNOMEDITS tools.');
    } else {
        const video = document.getElementById('cutPreview');
        if (video) {
            video.onloadedmetadata = () => {
                cutDuration = video.duration || 0;
                cutState.trimStart = 0;
                cutState.trimEnd = cutDuration;
                const start = document.getElementById('cutTrimStart');
                const end = document.getElementById('cutTrimEnd');
                if (start) {
                    start.max = String(cutDuration);
                    start.value = '0';
                }
                if (end) {
                    end.max = String(cutDuration);
                    end.value = String(cutDuration);
                }
                updateCutTrimUI();
                hideCutEmpty();
            };
            video.onerror = () => {
                setCutStatus(typeof tx === 'function' ? tx('cut.loadFailVideo') : 'Could not load this video.');
                notify(typeof tx === 'function' ? tx('cut.loadFailVideo') : 'Could not load this video.', true);
            };
            video.classList.add('capcut-media', 'capcut-filter-preview');
            showCutMediaEl(video, true);
            video.style.objectFit = cutState.fit === 'cover' ? 'cover' : cutState.fit === 'fill' ? 'fill' : 'contain';
            video.src = cutObjectUrl;
            video.load();
        }
        syncCutModeUI();
        cutRaf = requestAnimationFrame(syncCutTransport);
        setCutStatus(typeof tx === 'function' ? tx('cut.ready') : 'Video imported — use the MAGNOMEDITS tool dock.');
    }

    syncControlsFromState();
    applyAllCutVisuals();
    openCapcutPanel('media');
    pushCutHistory();
}

function toggleCutMusicPreview() {
    if (!cutImportedFile) {
        notify(cutNeedMediaMsg(), true);
        return;
    }
    if (cutState.music === 'none') {
        notify(typeof tx === 'function' ? tx('cut.pickMusic') : 'Pick a music bed first', true);
        openCapcutPanel('audio');
        return;
    }
    if (cutMusicNodes) {
        stopCutMusic();
        setCutStatus(typeof tx === 'function' ? tx('cut.musicStopped') : 'Music stopped');
        return;
    }
    startCutMusic();
    setCutStatus(typeof tx === 'function' ? tx('cut.musicPlaying') : 'Playing music preview…');
}

function toggleCutPlayback() {
    if (!cutImportedFile) {
        notify(cutNeedMediaMsg(), true);
        return;
    }
    // Photos: Play toggles music preview (CapCut photo+sound style)
    if (cutMediaKind === 'image') {
        if (cutState.music === 'none') {
            openCapcutPanel('audio');
            notify(typeof tx === 'function' ? tx('cut.pickMusic') : 'Pick a music bed for this photo', true);
            return;
        }
        toggleCutMusicPreview();
        return;
    }
    const video = document.getElementById('cutPreview');
    if (!video?.src && !video?.currentSrc) {
        notify(cutNeedMediaMsg(), true);
        return;
    }
    if (video.paused) {
        if (video.currentTime < cutState.trimStart || (cutState.trimEnd && video.currentTime >= cutState.trimEnd)) {
            video.currentTime = cutState.trimStart;
        }
        video.play().catch(() => {});
        startCutMusic();
    } else {
        video.pause();
        stopCutMusic();
    }
}

function ensureCutAudio() {
    if (!cutAudioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return null;
        cutAudioCtx = new Ctx();
    }
    if (cutAudioCtx.state === 'suspended') cutAudioCtx.resume();
    return cutAudioCtx;
}

function stopCutMusic() {
    if (cutMusicTimer) {
        clearInterval(cutMusicTimer);
        cutMusicTimer = null;
    }
    if (cutMusicNodes) {
        try { cutMusicNodes.osc.forEach((o) => o.stop()); } catch (_) {}
        try { cutMusicNodes.gain.disconnect(); } catch (_) {}
        cutMusicNodes = null;
    }
}

function startCutMusic(destNode) {
    stopCutMusic();
    if (cutState.music === 'none') return null;
    const ctx = ensureCutAudio();
    if (!ctx) return null;
    const bed = cutMusicById(cutState.music);
    if (!bed?.freqs?.length) return null;
    const gain = ctx.createGain();
    gain.gain.value = cutState.musicVol;
    gain.connect(ctx.destination);
    if (destNode) gain.connect(destNode);
    const freqs = bed.freqs;
    const wave = bed.wave || 'sine';
    const stepMs = bed.stepMs || 280;
    const osc = freqs.map((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        const waves = [wave, 'triangle', 'sine', 'sawtooth'];
        o.type = waves[i % waves.length];
        o.frequency.value = f;
        g.gain.value = 0.045 / freqs.length;
        o.connect(g);
        g.connect(gain);
        o.start();
        return o;
    });
    cutMusicNodes = { gain, osc, dest: destNode || null };
    let step = 0;
    cutMusicTimer = setInterval(() => {
        if (!cutMusicNodes) return;
        step += 1;
        cutMusicNodes.osc.forEach((o, i) => {
            o.frequency.setTargetAtTime(freqs[(step + i) % freqs.length], ctx.currentTime, 0.05);
        });
    }, stepMs);
    return cutMusicNodes;
}

async function exportCutImageWithMusic() {
    const image = document.getElementById('cutImagePreview');
    if (!image?.src) throw new Error('No image');
    if (!image.complete) {
        await new Promise((resolve, reject) => {
            const t = setTimeout(resolve, 1200);
            image.onload = () => { clearTimeout(t); resolve(); };
            image.onerror = () => { clearTimeout(t); reject(new Error('Image failed to load')); };
        });
    }
    const seconds = Math.min(20, Math.max(3, cutState.photoDuration || 8));
    const { w, h } = cutCanvasSize();
    const canvas = document.getElementById('cutCanvas') || document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(30);
    let mediaStream = stream;
    try {
        const audioCtx = ensureCutAudio();
        if (audioCtx) {
            const dest = audioCtx.createMediaStreamDestination();
            startCutMusic(dest);
            mediaStream = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
        }
    } catch (_) {
        mediaStream = stream;
    }

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
    const recorder = new MediaRecorder(mediaStream, { mimeType: mime, videoBitsPerSecond: 3500000 });
    const chunks = [];
    recorder.ondataavailable = (ev) => { if (ev.data?.size) chunks.push(ev.data); };

    let drawing = true;
    const draw = () => {
        if (!drawing) return;
        drawCutMediaFrame(ctx, image, w, h, image.style.filter || 'none');
        drawCutOverlays(ctx, w, h);
        requestAnimationFrame(draw);
    };

    const recorded = new Promise((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
        recorder.onerror = () => reject(new Error('Recorder failed'));
    });
    recorder.start(100);
    draw();
    await new Promise((r) => setTimeout(r, seconds * 1000));
    drawing = false;
    stopCutMusic();
    if (recorder.state !== 'inactive') recorder.stop();
    const blob = await recorded;
    if (!blob.size) throw new Error('Empty export');
    return blob;
}

function previewCutEffect() {
    const media = getCutPreviewEl();
    const flash = document.getElementById('cutFxFlash');
    const inner = document.getElementById('cutPreviewInner');
    if (!media || (!media.src && !media.currentSrc)) {
        notify(cutNeedMediaMsg(), true);
        return;
    }
    const fx = cutEffectById(cutState.effect);
    if (!fx || fx.kind === 'none') {
        notify(typeof tx === 'function' ? tx('cut.pickEffect') : 'Pick an effect first', true);
        return;
    }
    const dur = fx.fast ? 220 : 420;
    if (fx.kind === 'flash' && flash) {
        flash.style.background = fx.color || '#fff';
        flash.classList.remove('pulse');
        void flash.offsetWidth;
        flash.classList.add('pulse');
    }
    if (fx.kind === 'zoom' && inner) {
        const s = fx.scale || 1.08;
        inner.animate(
            [{ transform: 'scale(1)' }, { transform: `scale(${s})` }, { transform: 'scale(1)' }],
            { duration: dur, easing: 'ease-out' },
        );
    }
    if (fx.kind === 'shake' && inner) {
        const a = fx.amp || 6;
        const frames = fx.fast
            ? [
                { transform: 'translateX(0)' },
                { transform: `translateX(${-a}px)` },
                { transform: `translateX(${a}px)` },
                { transform: `translateX(${-a / 2}px)` },
                { transform: 'translateX(0)' },
            ]
            : [
                { transform: 'translateX(0)' },
                { transform: `translateX(${-a}px)` },
                { transform: `translateX(${a}px)` },
                { transform: 'translateX(0)' },
            ];
        inner.animate(frames, { duration: fx.fast ? 180 : 280 });
    }
    if (fx.kind === 'glitch' && media) {
        const hue = fx.hue || 80;
        media.animate(
            [
                { filter: media.style.filter },
                { filter: `${media.style.filter} hue-rotate(${hue}deg)` },
                { filter: `${media.style.filter} hue-rotate(${-hue / 2}deg)` },
                { filter: media.style.filter },
            ],
            { duration: 320 },
        );
    }
    if (fx.kind === 'blur' && media) {
        const px = fx.px || 8;
        media.animate(
            [
                { filter: media.style.filter },
                { filter: `${media.style.filter} blur(${px}px)` },
                { filter: media.style.filter },
            ],
            { duration: 500 },
        );
    }
    if (fx.kind === 'spin' && inner) {
        const deg = fx.deg || 8;
        inner.animate(
            [{ transform: 'rotate(0deg)' }, { transform: `rotate(${deg}deg)` }, { transform: 'rotate(0deg)' }],
            { duration: Math.abs(deg) > 90 ? 700 : 360, easing: 'ease-in-out' },
        );
    }
    if (fx.kind === 'bounce' && inner) {
        const y = fx.big ? -28 : -14;
        inner.animate(
            [
                { transform: 'translateY(0)' },
                { transform: `translateY(${y}px)` },
                { transform: 'translateY(0)' },
                { transform: `translateY(${y / 2}px)` },
                { transform: 'translateY(0)' },
            ],
            { duration: 520, easing: 'ease-out' },
        );
    }
    if (fx.kind === 'fade' && media) {
        media.animate([{ opacity: 1 }, { opacity: 0.15 }, { opacity: 1 }], { duration: 420 });
    }
    if (fx.kind === 'tilt' && inner) {
        const deg = fx.deg || -6;
        inner.animate(
            [{ transform: 'rotate(0)' }, { transform: `rotate(${deg}deg)` }, { transform: 'rotate(0)' }],
            { duration: 400 },
        );
    }
    if (fx.kind === 'kenburns' && inner) {
        inner.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.12) translateY(-2%)' }, { transform: 'scale(1)' }],
            { duration: 900, easing: 'ease-in-out' },
        );
    }
    if (fx.kind === 'heartbeat' && inner) {
        inner.animate(
            [
                { transform: 'scale(1)' },
                { transform: 'scale(1.06)' },
                { transform: 'scale(1)' },
                { transform: 'scale(1.1)' },
                { transform: 'scale(1)' },
            ],
            { duration: 700 },
        );
    }
    if (fx.kind === 'drift' && inner) {
        inner.animate(
            [{ transform: 'translateX(0)' }, { transform: 'translateX(18px)' }, { transform: 'translateX(0)' }],
            { duration: 500 },
        );
    }
    if (fx.kind === 'rise' && inner) {
        inner.animate(
            [{ transform: 'translateY(12%)', opacity: 0.6 }, { transform: 'translateY(0)', opacity: 1 }],
            { duration: 450 },
        );
    }
    if (fx.kind === 'drop' && inner) {
        inner.animate(
            [{ transform: 'translateY(-12%)', opacity: 0.6 }, { transform: 'translateY(0)', opacity: 1 }],
            { duration: 450 },
        );
    }
    if (fx.kind === 'swing' && inner) {
        inner.animate(
            [
                { transform: 'rotate(0deg)' },
                { transform: 'rotate(5deg)' },
                { transform: 'rotate(-5deg)' },
                { transform: 'rotate(0deg)' },
            ],
            { duration: 480 },
        );
    }
    if (fx.kind === 'elastic' && inner) {
        inner.animate(
            [
                { transform: 'scale(1)' },
                { transform: 'scale(1.2)' },
                { transform: 'scale(0.92)' },
                { transform: 'scale(1.05)' },
                { transform: 'scale(1)' },
            ],
            { duration: 650 },
        );
    }
    if (fx.kind === 'pop' && inner) {
        inner.animate(
            [{ transform: 'scale(0.7)', opacity: 0.4 }, { transform: 'scale(1.08)' }, { transform: 'scale(1)', opacity: 1 }],
            { duration: 380 },
        );
    }
    if (fx.kind === 'wobble' && inner) {
        inner.animate(
            [
                { transform: 'rotate(0) scaleX(1)' },
                { transform: 'rotate(3deg) scaleX(1.04)' },
                { transform: 'rotate(-3deg) scaleX(0.96)' },
                { transform: 'rotate(0) scaleX(1)' },
            ],
            { duration: 450 },
        );
    }
    if (fx.kind === 'strobe' && flash) {
        flash.style.background = '#fff';
        [0, 80, 160].forEach((d) => {
            setTimeout(() => {
                flash.classList.remove('pulse');
                void flash.offsetWidth;
                flash.classList.add('pulse');
            }, d);
        });
    }
    if (fx.kind === 'ripple' && inner) {
        inner.animate(
            [
                { transform: 'scale(1)', offset: 0 },
                { transform: 'scale(1.04)', offset: 0.35 },
                { transform: 'scale(0.98)', offset: 0.7 },
                { transform: 'scale(1)', offset: 1 },
            ],
            { duration: 560 },
        );
    }
    if (fx.kind === 'float' && inner) {
        inner.animate(
            [{ transform: 'translateY(0)' }, { transform: 'translateY(-10px)' }, { transform: 'translateY(0)' }],
            { duration: 900, easing: 'ease-in-out' },
        );
    }
}

function fillClipFormFromExport(file, title) {
    const titleInput = document.getElementById('clipTitle');
    const fileInput = document.getElementById('clipFile');
    if (titleInput) titleInput.value = title;
    try {
        const dt = new DataTransfer();
        dt.items.add(file);
        if (fileInput) fileInput.files = dt.files;
    } catch (_) {}
    document.getElementById('clipCreateFormWrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function cutCanvasSize() {
    const w = cutState.ratio === '16x9' ? 1280 : cutState.ratio === '1x1' ? 720 : 720;
    const h = cutState.ratio === '16x9' ? 720 : cutState.ratio === '1x1' ? 720 : 1280;
    return { w, h };
}

function drawCutCaptionStyled(ctx, caption, cx, cy, w) {
    const style = cutState.textStyle || 'gold';
    const size = Math.round(w * 0.06);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.lineWidth = 0;

    const drawBubble = (bg, fg) => {
        ctx.font = `800 ${size}px Oxanium, sans-serif`;
        const metrics = ctx.measureText(caption);
        const bw = metrics.width + 36;
        const bh = Math.round(w * 0.08);
        ctx.fillStyle = bg;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, style === 'sticky' ? 8 : 999);
            ctx.fill();
        } else {
            ctx.fillRect(cx - bw / 2, cy - bh / 2, bw, bh);
        }
        ctx.fillStyle = fg;
        ctx.fillText(caption, cx, cy);
    };

    if (style === 'gold') {
        ctx.font = `800 ${size}px Oxanium, sans-serif`;
        ctx.fillStyle = '#F0B429';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 8;
        ctx.fillText(caption, cx, cy);
    } else if (style === 'neon' || style === 'glowCyan' || style === 'iceText') {
        ctx.font = `800 ${size}px Oxanium, sans-serif`;
        ctx.fillStyle = style === 'iceText' ? '#B8F0FF' : '#5EEAD4';
        ctx.shadowColor = 'rgba(94,234,212,0.9)';
        ctx.shadowBlur = 18;
        ctx.fillText(caption, cx, cy);
    } else if (style === 'impact' || style === 'comic') {
        ctx.font = `900 ${size}px Oxanium, Impact, sans-serif`;
        const text = style === 'impact' ? caption.toUpperCase() : caption;
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#111';
        ctx.fillStyle = '#fff';
        ctx.strokeText(text, cx, cy);
        ctx.fillText(text, cx, cy);
    } else if (style === 'bubble' || style === 'banner') {
        drawBubble('#F0B429', '#111');
    } else if (style === 'pink' || style === 'glowPink') {
        ctx.font = `800 ${size}px Oxanium, sans-serif`;
        ctx.fillStyle = '#FE2C55';
        ctx.shadowColor = 'rgba(254,44,85,0.85)';
        ctx.shadowBlur = 16;
        ctx.fillText(caption, cx, cy);
    } else if (style === 'outline') {
        ctx.font = `800 ${size}px Oxanium, sans-serif`;
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff';
        ctx.fillStyle = 'transparent';
        ctx.strokeText(caption, cx, cy);
    } else if (style === 'shadow') {
        ctx.font = `800 ${size}px Oxanium, sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.95)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetX = 4;
        ctx.shadowOffsetY = 6;
        ctx.fillText(caption, cx, cy);
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
    } else if (style === 'typewriter' || style === 'chalk' || style === 'minimal') {
        ctx.font = `600 ${size}px "Courier New", monospace`;
        ctx.fillStyle = style === 'chalk' ? '#E8E8E8' : '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.7)';
        ctx.shadowBlur = 6;
        ctx.fillText(caption, cx, cy);
    } else if (style === 'gradient' || style === 'fireText') {
        ctx.font = `800 ${size}px Oxanium, sans-serif`;
        const g = ctx.createLinearGradient(cx - 80, cy, cx + 80, cy);
        if (style === 'fireText') {
            g.addColorStop(0, '#FF2D55');
            g.addColorStop(0.5, '#FF8A3D');
            g.addColorStop(1, '#F0B429');
        } else {
            g.addColorStop(0, '#F0B429');
            g.addColorStop(1, '#FFE08A');
        }
        ctx.fillStyle = g;
        ctx.fillText(caption, cx, cy);
    } else if (style === 'sticky') {
        drawBubble('#FFE08A', '#222');
    } else if (style === 'boxed') {
        drawBubble('#fff', '#111');
    } else {
        ctx.font = `800 ${size}px Oxanium, sans-serif`;
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.85)';
        ctx.shadowBlur = 10;
        ctx.fillText(caption, cx, cy);
    }
    ctx.shadowBlur = 0;
}

function drawCutOverlays(ctx, w, h) {
    const caption = cutState.captionText || document.getElementById('cutCaption')?.value.trim() || '';
    if (caption) {
        const cx = (cutState.captionX / 100) * w;
        const cy = (cutState.captionY / 100) * h;
        drawCutCaptionStyled(ctx, caption, cx, cy, w);
    }
    if (cutState.sticker) {
        const sx = (cutState.stickerX / 100) * w;
        const sy = (cutState.stickerY / 100) * h;
        ctx.font = `${Math.round(w * 0.12)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowBlur = 0;
        ctx.fillText(cutState.sticker, sx, sy);
    }
}

function drawCutMediaFrame(ctx, source, w, h, filterCss) {
    ctx.save();
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.translate(w / 2, h / 2);
    if (cutState.flipX) ctx.scale(-1, 1);
    if (cutState.rotate) ctx.rotate((cutState.rotate * Math.PI) / 180);

    const sw = source.videoWidth || source.naturalWidth || w;
    const sh = source.videoHeight || source.naturalHeight || h;
    let dw;
    let dh;
    const fit = cutState.fit || 'contain';
    if (fit === 'fill') {
        dw = w;
        dh = h;
    } else if (fit === 'cover') {
        const scale = Math.max(w / sw, h / sh);
        dw = sw * scale;
        dh = sh * scale;
    } else {
        const scale = Math.min(w / sw, h / sh);
        dw = sw * scale;
        dh = sh * scale;
    }
    ctx.filter = filterCss || 'none';
    ctx.drawImage(source, -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
    ctx.filter = 'none';
}

async function exportCutImage() {
    const image = document.getElementById('cutImagePreview');
    if (!image?.src) throw new Error('No image');
    if (!image.complete) {
        await new Promise((resolve, reject) => {
            const t = setTimeout(resolve, 1200);
            image.onload = () => { clearTimeout(t); resolve(); };
            image.onerror = () => { clearTimeout(t); reject(new Error('Image failed to load')); };
        });
    }
    const { w, h } = cutCanvasSize();
    const canvas = document.getElementById('cutCanvas') || document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    drawCutMediaFrame(ctx, image, w, h, image.style.filter || 'none');
    drawCutOverlays(ctx, w, h);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob?.size) throw new Error('Empty image export');
    return blob;
}

async function exportCutVideo() {
    const video = document.getElementById('cutPreview');
    const start = cutState.trimStart || 0;
    const end = cutState.trimEnd > start ? cutState.trimEnd : cutDuration || video.duration || 0;
    const exportSeconds = Math.min(45, Math.max(1, end - start));

    video.pause();
    stopCutMusic();
    video.currentTime = start;
    await new Promise((resolve) => {
        const done = () => { video.removeEventListener('seeked', done); resolve(); };
        video.addEventListener('seeked', done);
        setTimeout(resolve, 500);
    });

    const { w, h } = cutCanvasSize();
    const canvas = document.getElementById('cutCanvas') || document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    const stream = canvas.captureStream(30);
    let mediaStream = stream;

    try {
        const audioCtx = ensureCutAudio();
        if (audioCtx && !cutAudioBound) {
            const dest = audioCtx.createMediaStreamDestination();
            const source = audioCtx.createMediaElementSource(video);
            cutAudioBound = true;
            const g = audioCtx.createGain();
            g.gain.value = cutState.videoVol;
            source.connect(g);
            g.connect(dest);
            g.connect(audioCtx.destination);
            mediaStream = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
        } else {
            mediaStream = stream;
        }
    } catch (_) {
        mediaStream = stream;
    }

    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
    const recorder = new MediaRecorder(mediaStream, { mimeType: mime, videoBitsPerSecond: 4500000 });
    const chunks = [];
    recorder.ondataavailable = (ev) => { if (ev.data?.size) chunks.push(ev.data); };

    let drawing = true;
    const draw = () => {
        if (!drawing || video.paused || video.ended || video.currentTime >= end) return;
        drawCutMediaFrame(ctx, video, w, h, video.style.filter || 'none');
        drawCutOverlays(ctx, w, h);
        requestAnimationFrame(draw);
    };

    const recorded = new Promise((resolve, reject) => {
        recorder.onstop = () => resolve(new Blob(chunks, { type: 'video/webm' }));
        recorder.onerror = () => reject(new Error('Recorder failed'));
    });
    recorder.start(100);
    video.playbackRate = cutState.speed;
    await video.play();
    draw();
    await new Promise((r) => setTimeout(r, (exportSeconds * 1000) / Math.max(0.25, cutState.speed)));
    drawing = false;
    video.pause();
    if (recorder.state !== 'inactive') recorder.stop();
    const blob = await recorded;
    if (!blob.size) throw new Error('Empty export');
    return blob;
}

async function exportMagnomCutProject() {
    if (!cutImportedFile || !cutMediaKind) {
        notify(cutNeedMediaMsg(), true);
        return;
    }
    const media = getCutPreviewEl();
    if (!media || (!media.src && !media.currentSrc)) {
        notify(cutNeedMediaMsg(), true);
        return;
    }
    const projectName =
        document.getElementById('cutProjectName')?.value.trim() ||
        document.getElementById('cutCaption')?.value.trim() ||
        cutImportedFile.name.replace(/\.[^.]+$/, '') ||
        'MAGNOMEDITS';
    const progress = document.getElementById('cutExportProgress');
    const safeName = projectName.replace(/\s+/g, '_');

    try {
        if (progress) progress.textContent = cutMediaKind === 'image' ? 'Rendering image…' : 'Rendering video…';
        setCutStatus(typeof tx === 'function' ? tx('cut.exporting') : 'Exporting MAGNOMEDITS project…');

        let outFile;
        if (cutMediaKind === 'image') {
            if (cutState.music !== 'none') {
                if (progress) progress.textContent = 'Rendering photo + music…';
                const blob = await exportCutImageWithMusic();
                outFile = new File([blob], `${safeName}.webm`, { type: 'video/webm' });
            } else {
                const blob = await exportCutImage();
                outFile = new File([blob], `${safeName}.png`, { type: 'image/png' });
            }
        } else {
            const blob = await exportCutVideo();
            outFile = new File([blob], `${safeName}.webm`, { type: 'video/webm' });
        }

        fillClipFormFromExport(outFile, projectName);
        if (progress) progress.textContent = typeof tx === 'function' ? tx('cut.exported') : 'Export ready — press Post Clip';
        setCutStatus(typeof tx === 'function' ? tx('cut.exported') : 'Ready to post');
        notify(typeof tx === 'function' ? tx('cut.exported') : 'Export ready');
        openCapcutPanel('export');
    } catch (err) {
        fillClipFormFromExport(cutImportedFile, projectName);
        if (progress) progress.textContent = typeof tx === 'function' ? tx('cut.exportFallback') : 'Fallback export (original file)';
        setCutStatus(
            typeof tx === 'function'
                ? tx('cut.exportFail')
                : 'Could not burn effects in-browser — original file attached. You can still post.',
        );
        notify(err.message || 'Export fallback used', true);
    }
}

function bindCutOverlayDrag(el, kind) {
    if (!el) return;
    el.addEventListener('pointerdown', (ev) => {
        if (!el.classList.contains('on')) return;
        cutDragTarget = { el, kind };
        const inner = document.getElementById('cutPreviewInner');
        if (!inner) return;
        const rect = inner.getBoundingClientRect();
        const px = ((ev.clientX - rect.left) / rect.width) * 100;
        const py = ((ev.clientY - rect.top) / rect.height) * 100;
        if (kind === 'caption') {
            cutDragOffset.x = px - cutState.captionX;
            cutDragOffset.y = py - cutState.captionY;
        } else {
            cutDragOffset.x = px - cutState.stickerX;
            cutDragOffset.y = py - cutState.stickerY;
        }
        el.classList.add('dragging');
        el.setPointerCapture?.(ev.pointerId);
        ev.preventDefault();
    });
}

function onCutPointerMove(ev) {
    if (!cutDragTarget) return;
    const inner = document.getElementById('cutPreviewInner');
    if (!inner) return;
    const rect = inner.getBoundingClientRect();
    let x = ((ev.clientX - rect.left) / rect.width) * 100 - cutDragOffset.x;
    let y = ((ev.clientY - rect.top) / rect.height) * 100 - cutDragOffset.y;
    x = Math.min(95, Math.max(5, x));
    y = Math.min(95, Math.max(5, y));
    if (cutDragTarget.kind === 'caption') {
        cutState.captionX = x;
        cutState.captionY = y;
        applyCutCaption();
    } else {
        cutState.stickerX = x;
        cutState.stickerY = y;
        applyCutSticker();
    }
}

function onCutPointerUp() {
    if (!cutDragTarget) return;
    cutDragTarget.el.classList.remove('dragging');
    cutDragTarget = null;
    pushCutHistory();
    updateTimelineLabels();
}

function seekCutTimeline(e) {
    if (cutMediaKind !== 'video') return;
    const video = document.getElementById('cutPreview');
    const tl = document.getElementById('cutTimeline');
    if (!video?.src || !tl || !cutDuration) return;
    const rect = tl.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    video.currentTime = ratio * cutDuration;
}

function initMagnomCut() {
    if (!document.getElementById('magnomCutStudio')) return;
    populateMagnomCutLibrary();

    const canvas = document.getElementById('cutCanvas');
    if (canvas) {
        canvas.setAttribute('hidden', '');
        canvas.style.cssText =
            'position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;';
    }

    document.getElementById('cutImport')?.addEventListener('change', handleCutImport);
    document.getElementById('capcutDock')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.capcut-dock-btn');
        if (!btn || btn.disabled) return;
        openCapcutPanel(btn.dataset.panel);
    });

    document.getElementById('cutFilters')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-filter]');
        if (!btn) return;
        cutState.filter = btn.dataset.filter;
        document.querySelectorAll('#cutFilters .capcut-chip').forEach((c) => c.classList.toggle('active', c === btn));
        applyCutVisuals();
        pushCutHistory();
    });

    document.getElementById('cutTextStyles')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-style]');
        if (!btn) return;
        cutState.textStyle = btn.dataset.style;
        document.querySelectorAll('#cutTextStyles .capcut-chip').forEach((c) => c.classList.toggle('active', c === btn));
        applyCutCaption();
        pushCutHistory();
    });

    document.getElementById('cutStickers')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-sticker]');
        if (!btn) return;
        cutState.sticker = btn.dataset.sticker || '';
        applyCutSticker();
        updateTimelineLabels();
        pushCutHistory();
    });

    document.getElementById('cutEffects')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-fx]');
        if (!btn) return;
        cutState.effect = btn.dataset.fx;
        document.querySelectorAll('#cutEffects .capcut-chip').forEach((c) => c.classList.toggle('active', c === btn));
        pushCutHistory();
    });

    document.getElementById('cutMusicChips')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-music]');
        if (!btn) return;
        cutState.music = btn.dataset.music;
        document.querySelectorAll('#cutMusicChips .capcut-chip').forEach((c) => c.classList.toggle('active', c === btn));
        updateTimelineLabels();
        const video = document.getElementById('cutPreview');
        if (cutMediaKind === 'video' && video && !video.paused) {
            startCutMusic();
        } else if (cutMediaKind === 'image') {
            // CapCut-style: selecting a bed starts preview on photos
            if (cutState.music === 'none') stopCutMusic();
            else startCutMusic();
        }
        pushCutHistory();
    });

    document.getElementById('cutRatios')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-ratio]');
        if (!btn) return;
        cutState.ratio = btn.dataset.ratio;
        document.querySelectorAll('#cutRatios .capcut-chip').forEach((c) => c.classList.toggle('active', c === btn));
        applyCutRatio();
        pushCutHistory();
    });

    document.getElementById('cutFitModes')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-fit]');
        if (!btn) return;
        setCutFit(btn.dataset.fit);
    });

    const bindRange = (id, key, labelId, fmt) => {
        const el = document.getElementById(id);
        el?.addEventListener('input', () => {
            cutState[key] = parseFloat(el.value);
            const label = document.getElementById(labelId);
            if (label) label.textContent = fmt(cutState[key]);
            if (key === 'speed') applyCutSpeed();
            if (key === 'bright' || key === 'contrast' || key === 'saturate') applyCutVisuals();
            if (key === 'musicVol' || key === 'videoVol') {
                applyCutVolumes();
                if (cutMusicNodes) cutMusicNodes.gain.gain.value = cutState.musicVol;
            }
            if (key === 'trimStart' || key === 'trimEnd') {
                if (cutState.trimEnd < cutState.trimStart + 0.3) {
                    if (key === 'trimStart') cutState.trimEnd = Math.min(cutDuration, cutState.trimStart + 0.3);
                    else cutState.trimStart = Math.max(0, cutState.trimEnd - 0.3);
                }
                updateCutTrimUI();
            }
        });
        el?.addEventListener('change', () => pushCutHistory());
    };

    bindRange('cutSpeed', 'speed', 'cutSpeedVal', (v) => `${v.toFixed(2)}x`);
    bindRange('cutBright', 'bright', 'cutBrightVal', (v) => v.toFixed(2));
    bindRange('cutContrast', 'contrast', 'cutContrastVal', (v) => v.toFixed(2));
    bindRange('cutSaturate', 'saturate', 'cutSaturateVal', (v) => v.toFixed(2));
    bindRange('cutMusicVol', 'musicVol', 'cutMusicVolVal', (v) => `${Math.round(v * 100)}%`);
    bindRange('cutVideoVol', 'videoVol', 'cutVideoVolVal', (v) => `${Math.round(v * 100)}%`);
    bindRange('cutPhotoDuration', 'photoDuration', 'cutPhotoDurationVal', (v) => `${Math.round(v)}s`);
    bindRange('cutTrimStart', 'trimStart', 'cutTrimStartVal', (v) => `${v.toFixed(1)}s`);
    bindRange('cutTrimEnd', 'trimEnd', 'cutTrimEndVal', (v) => `${v.toFixed(1)}s`);

    document.getElementById('cutCaption')?.addEventListener('input', () => {
        applyCutCaption();
        updateTimelineLabels();
    });
    document.getElementById('cutCaption')?.addEventListener('change', () => pushCutHistory());

    document.getElementById('cutTimeline')?.addEventListener('click', seekCutTimeline);

    bindCutOverlayDrag(document.getElementById('cutCaptionOverlay'), 'caption');
    bindCutOverlayDrag(document.getElementById('cutStickerOverlay'), 'sticker');
    window.addEventListener('pointermove', onCutPointerMove);
    window.addEventListener('pointerup', onCutPointerUp);
    window.addEventListener('pointercancel', onCutPointerUp);

    syncCutModeUI();
    showCutEmpty();
    applyAllCutVisuals();
    updateCutHistoryButtons();
}

window.initMagnomCut = initMagnomCut;
window.exportMagnomCutProject = exportMagnomCutProject;
window.toggleCutPlayback = toggleCutPlayback;
window.toggleCutMusicPreview = toggleCutMusicPreview;
window.setCutCaptionPreset = setCutCaptionPreset;
window.applyMagnomCutTemplate = applyMagnomCutTemplate;
window.filterMagnomCutTemplates = filterMagnomCutTemplates;
window.setMagnomTemplateTab = setMagnomTemplateTab;
window.setCutSpeed = setCutSpeed;
window.previewCutEffect = previewCutEffect;
window.applyCutTrimToPlayhead = applyCutTrimToPlayhead;
window.cutUndo = cutUndo;
window.cutRedo = cutRedo;
window.cutFlip = cutFlip;
window.cutRotate = cutRotate;
window.setCutFit = setCutFit;
