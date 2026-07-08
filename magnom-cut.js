/* MAGNOMCUT editor */

let cutObjectUrl = null;
let cutImportedFile = null;
let cutDuration = 0;
let cutState = {
    filter: 'none',
    textStyle: 'gold',
    sticker: '',
    effect: 'none',
    music: 'none',
    ratio: '9x16',
    bright: 1,
    contrast: 1,
    saturate: 1,
    speed: 1,
    trimStart: 0,
    trimEnd: 0,
    musicVol: 0.35,
    videoVol: 1,
};

let cutAudioCtx = null;
let cutMusicNodes = null;
let cutMusicTimer = null;
let cutRaf = null;

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

function openCapcutPanel(name) {
    document.querySelectorAll('#capcutDock .capcut-dock-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.panel === name);
    });
    document.querySelectorAll('.capcut-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.dataset.panel === name);
    });
    const title = document.getElementById('capcutSideTitle');
    if (title) title.textContent = name.charAt(0).toUpperCase() + name.slice(1);
}

function applyCutVisuals() {
    const video = document.getElementById('cutPreview');
    if (!video) return;
    const filterMap = {
        none: '',
        gold: 'saturate(1.25) contrast(1.08) sepia(0.28) hue-rotate(-8deg)',
        neon: 'saturate(1.45) contrast(1.15) brightness(1.05) hue-rotate(150deg)',
        heat: 'saturate(1.4) contrast(1.2) sepia(0.35) hue-rotate(-25deg)',
        ice: 'saturate(0.85) contrast(1.1) brightness(1.08) hue-rotate(180deg)',
        cinema: 'contrast(1.25) saturate(0.9) brightness(0.92)',
        retro: 'sepia(0.45) contrast(1.15) saturate(1.2)',
        glow: 'brightness(1.15) contrast(1.2) saturate(1.35)',
    };
    const base = filterMap[cutState.filter] || '';
    const adj = `brightness(${cutState.bright}) contrast(${cutState.contrast}) saturate(${cutState.saturate})`;
    video.style.filter = `${base} ${adj}`.trim();
    video.className = 'capcut-filter-preview' + (cutState.filter !== 'none' ? ` filter-${cutState.filter}` : '');
}

function applyCutCaption() {
    const overlay = document.getElementById('cutCaptionOverlay');
    const text = document.getElementById('cutCaption')?.value.trim() || '';
    if (!overlay) return;
    overlay.textContent = text;
    overlay.className = `capcut-text-overlay s-${cutState.textStyle}` + (text ? ' on' : '');
}

function applyCutSticker() {
    const el = document.getElementById('cutStickerOverlay');
    if (!el) return;
    el.textContent = cutState.sticker || '';
    el.classList.toggle('on', !!cutState.sticker);
}

function applyCutSpeed() {
    const video = document.getElementById('cutPreview');
    const label = document.getElementById('cutSpeedVal');
    if (label) label.textContent = `${cutState.speed.toFixed(2)}x`;
    if (video) video.playbackRate = cutState.speed;
}

function applyCutVolumes() {
    const video = document.getElementById('cutPreview');
    if (video) video.volume = cutState.videoVol;
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

function setCutSpeed(v) {
    const input = document.getElementById('cutSpeed');
    if (input) input.value = String(v);
    cutState.speed = v;
    applyCutSpeed();
}

function setCutCaptionPreset(text) {
    const input = document.getElementById('cutCaption');
    if (input) input.value = text;
    applyCutCaption();
}

function updateCutTrimUI() {
    const startLabel = document.getElementById('cutTrimStartVal');
    const endLabel = document.getElementById('cutTrimEndVal');
    if (startLabel) startLabel.textContent = `${cutState.trimStart.toFixed(1)}s`;
    if (endLabel) endLabel.textContent = `${cutState.trimEnd.toFixed(1)}s`;
    const range = document.getElementById('cutTrimRange');
    if (range && cutDuration > 0) {
        const left = (cutState.trimStart / cutDuration) * 100;
        const right = 100 - (cutState.trimEnd / cutDuration) * 100;
        range.style.left = `${Math.max(0, left)}%`;
        range.style.right = `${Math.max(0, right)}%`;
    }
}

function applyCutTrimToPlayhead() {
    const video = document.getElementById('cutPreview');
    if (video) video.currentTime = cutState.trimStart;
}

function syncCutTransport() {
    const video = document.getElementById('cutPreview');
    if (!video) return;
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

function handleCutImport(e) {
    const file = e.target.files?.[0];
    const video = document.getElementById('cutPreview');
    const hint = document.getElementById('cutEmptyHint');
    if (!file || !video) return;
    if (cutObjectUrl) URL.revokeObjectURL(cutObjectUrl);
    cutImportedFile = file;
    cutObjectUrl = URL.createObjectURL(file);
    video.src = cutObjectUrl;
    video.load();
    document.getElementById('cutMediaName').textContent = file.name;
    const project = document.getElementById('cutProjectName');
    if (project && !project.value.trim()) {
        project.value = file.name.replace(/\.[^.]+$/, '');
    }
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
    };
    if (hint) hint.classList.add('hidden');
    applyCutVisuals();
    applyCutSpeed();
    applyCutCaption();
    applyCutVolumes();
    applyCutRatio();
    cancelAnimationFrame(cutRaf);
    cutRaf = requestAnimationFrame(syncCutTransport);
    setCutStatus(typeof tx === 'function' ? tx('cut.ready') : 'Video imported');
}

function toggleCutPlayback() {
    const video = document.getElementById('cutPreview');
    if (!video?.src) {
        notify(typeof tx === 'function' ? tx('cut.needVideo') : 'Import a video first', true);
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
        try { cutMusicNodes.gain.disconnect(); } catch { /* ignore */ }
        try { cutMusicNodes.osc.forEach((o) => o.stop()); } catch { /* ignore */ }
        cutMusicNodes = null;
    }
}

function startCutMusic() {
    stopCutMusic();
    if (cutState.music === 'none' || cutState.musicVol <= 0) return;
    const ctx = ensureCutAudio();
    if (!ctx) return;
    const gain = ctx.createGain();
    gain.gain.value = cutState.musicVol;
    gain.connect(ctx.destination);
    const patterns = {
        pulse: [110, 165, 220],
        boost: [98, 196, 294],
        clutch: [130, 196, 261],
    };
    const freqs = patterns[cutState.music] || patterns.pulse;
    const osc = freqs.map((f, i) => {
        const o = ctx.createOscillator();
        o.type = i === 0 ? 'sawtooth' : 'triangle';
        o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.value = 0.08 / (i + 1);
        o.connect(g);
        g.connect(gain);
        o.start();
        return o;
    });
    cutMusicNodes = { gain, osc };
    let step = 0;
    cutMusicTimer = setInterval(() => {
        if (!cutMusicNodes) return;
        step += 1;
        cutMusicNodes.osc.forEach((o, i) => {
            o.frequency.setTargetAtTime(freqs[(step + i) % freqs.length], ctx.currentTime, 0.05);
        });
    }, 280);
}

function previewCutEffect() {
    const video = document.getElementById('cutPreview');
    const flash = document.getElementById('cutFxFlash');
    const inner = document.getElementById('cutPreviewInner');
    if (!video?.src) {
        notify(typeof tx === 'function' ? tx('cut.needVideo') : 'Import a video first', true);
        return;
    }
    if (cutState.effect === 'flash' && flash) {
        flash.classList.remove('pulse');
        void flash.offsetWidth;
        flash.classList.add('pulse');
    }
    if (cutState.effect === 'zoom' && inner) {
        inner.animate(
            [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }],
            { duration: 420, easing: 'ease-out' },
        );
    }
    if (cutState.effect === 'shake' && inner) {
        inner.animate(
            [
                { transform: 'translateX(0)' },
                { transform: 'translateX(-6px)' },
                { transform: 'translateX(6px)' },
                { transform: 'translateX(0)' },
            ],
            { duration: 280 },
        );
    }
    if (cutState.effect === 'glitch' && video) {
        video.animate(
            [
                { filter: video.style.filter },
                { filter: `${video.style.filter} hue-rotate(80deg)` },
                { filter: video.style.filter },
            ],
            { duration: 320 },
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
    } catch {
        /* older browsers */
    }
    document.getElementById('clipCreateFormWrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function exportMagnomCutProject() {
    const video = document.getElementById('cutPreview');
    if (!cutImportedFile || !video?.src) {
        notify(typeof tx === 'function' ? tx('cut.needVideo') : 'Import a video first', true);
        return;
    }
    const projectName = document.getElementById('cutProjectName')?.value.trim()
        || document.getElementById('cutCaption')?.value.trim()
        || cutImportedFile.name.replace(/\.[^.]+$/, '')
        || 'MAGNOMCUT';
    const progress = document.getElementById('cutExportProgress');
    const start = cutState.trimStart || 0;
    const end = cutState.trimEnd > start ? cutState.trimEnd : (cutDuration || video.duration || 0);
    const exportSeconds = Math.min(45, Math.max(1, end - start));

    // Fast path if no visual burn needed heavily: still try canvas encode.
    try {
        if (progress) progress.textContent = 'Rendering…';
        setCutStatus('Exporting MAGNOMCUT project…');
        video.pause();
        stopCutMusic();
        video.currentTime = start;
        await new Promise((resolve) => {
            const done = () => { video.removeEventListener('seeked', done); resolve(); };
            video.addEventListener('seeked', done);
            setTimeout(resolve, 500);
        });

        const canvas = document.getElementById('cutCanvas') || document.createElement('canvas');
        const w = cutState.ratio === '16x9' ? 1280 : cutState.ratio === '1x1' ? 720 : 720;
        const h = cutState.ratio === '16x9' ? 720 : cutState.ratio === '1x1' ? 720 : 1280;
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        const stream = canvas.captureStream(30);
        let mediaStream = stream;
        try {
            const audioCtx = ensureCutAudio();
            if (audioCtx) {
                const dest = audioCtx.createMediaStreamDestination();
                const source = audioCtx.createMediaElementSource(video);
                const g = audioCtx.createGain();
                g.gain.value = cutState.videoVol;
                source.connect(g);
                g.connect(dest);
                g.connect(audioCtx.destination);
                mediaStream = new MediaStream([
                    ...stream.getVideoTracks(),
                    ...dest.stream.getAudioTracks(),
                ]);
            }
        } catch {
            /* video-only fallback */
        }

        const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
            ? 'video/webm;codecs=vp9'
            : 'video/webm';
        const recorder = new MediaRecorder(mediaStream, { mimeType: mime, videoBitsPerSecond: 4_500_000 });
        const chunks = [];
        recorder.ondataavailable = (ev) => { if (ev.data?.size) chunks.push(ev.data); };

        const draw = () => {
            if (video.paused || video.ended || video.currentTime >= end) return;
            ctx.filter = video.style.filter || 'none';
            // cover fit
            const vw = video.videoWidth || w;
            const vh = video.videoHeight || h;
            const scale = Math.max(w / vw, h / vh);
            const dw = vw * scale;
            const dh = vh * scale;
            const dx = (w - dw) / 2;
            const dy = (h - dh) / 2;
            ctx.fillStyle = '#000';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(video, dx, dy, dw, dh);
            ctx.filter = 'none';

            const caption = document.getElementById('cutCaption')?.value.trim() || '';
            if (caption) {
                ctx.textAlign = 'center';
                ctx.font = `800 ${Math.round(w * 0.06)}px Oxanium, sans-serif`;
                if (cutState.textStyle === 'gold') {
                    ctx.fillStyle = '#F0B429';
                    ctx.shadowColor = 'rgba(0,0,0,0.8)';
                    ctx.shadowBlur = 8;
                } else if (cutState.textStyle === 'neon') {
                    ctx.fillStyle = '#5EEAD4';
                    ctx.shadowColor = 'rgba(94,234,212,0.8)';
                    ctx.shadowBlur = 16;
                } else if (cutState.textStyle === 'impact') {
                    ctx.fillStyle = '#fff';
                    ctx.shadowColor = '#FF2D55';
                    ctx.shadowBlur = 0;
                    ctx.lineWidth = 4;
                    ctx.strokeStyle = '#111';
                    ctx.strokeText(caption.toUpperCase(), w / 2, h * 0.82);
                } else if (cutState.textStyle === 'bubble') {
                    const metrics = ctx.measureText(caption);
                    const bw = metrics.width + 36;
                    const bh = Math.round(w * 0.08);
                    ctx.fillStyle = '#F0B429';
                    ctx.beginPath();
                    ctx.roundRect?.(w / 2 - bw / 2, h * 0.78, bw, bh, 999);
                    if (!ctx.roundRect) {
                        ctx.fillRect(w / 2 - bw / 2, h * 0.78, bw, bh);
                    } else {
                        ctx.fill();
                    }
                    ctx.fillStyle = '#111';
                    ctx.shadowBlur = 0;
                    ctx.fillText(caption, w / 2, h * 0.78 + bh * 0.72);
                    requestAnimationFrame(draw);
                    return;
                } else {
                    ctx.fillStyle = '#fff';
                    ctx.shadowColor = 'rgba(0,0,0,0.85)';
                    ctx.shadowBlur = 10;
                }
                ctx.fillText(caption, w / 2, h * 0.84);
                ctx.shadowBlur = 0;
            }
            if (cutState.sticker) {
                ctx.font = `${Math.round(w * 0.12)}px sans-serif`;
                ctx.fillText(cutState.sticker, w * 0.82, h * 0.18);
            }
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
        video.pause();
        if (recorder.state !== 'inactive') recorder.stop();
        const blob = await recorded;
        if (!blob.size) throw new Error('Empty export');
        const outFile = new File([blob], `${projectName.replace(/\s+/g, '_')}.webm`, { type: 'video/webm' });
        fillClipFormFromExport(outFile, projectName);
        if (progress) progress.textContent = 'Export ready — press Post Clip';
        setCutStatus(typeof tx === 'function' ? tx('cut.exported') : 'Ready to post');
        notify(typeof tx === 'function' ? tx('cut.exported') : 'Export ready');
        openCapcutPanel('export');
    } catch (err) {
        // Fallback: original file + overlay settings note
        fillClipFormFromExport(cutImportedFile, projectName);
        if (progress) progress.textContent = 'Fallback export (original file)';
        setCutStatus('Could not burn effects in-browser — original file attached. You can still post.');
        notify(err.message || 'Export fallback used', true);
    }
}

function initMagnomCut() {
    if (!document.getElementById('magnomCutStudio')) return;

    document.getElementById('cutImport')?.addEventListener('change', handleCutImport);
    document.getElementById('capcutDock')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.capcut-dock-btn');
        if (!btn) return;
        openCapcutPanel(btn.dataset.panel);
    });

    document.getElementById('cutFilters')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-filter]');
        if (!btn) return;
        cutState.filter = btn.dataset.filter;
        document.querySelectorAll('#cutFilters .capcut-chip').forEach((c) => c.classList.toggle('active', c === btn));
        applyCutVisuals();
    });

    document.getElementById('cutTextStyles')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-style]');
        if (!btn) return;
        cutState.textStyle = btn.dataset.style;
        document.querySelectorAll('#cutTextStyles .capcut-chip').forEach((c) => c.classList.toggle('active', c === btn));
        applyCutCaption();
    });

    document.getElementById('cutStickers')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-sticker]');
        if (!btn) return;
        cutState.sticker = btn.dataset.sticker || '';
        applyCutSticker();
    });

    document.getElementById('cutEffects')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-fx]');
        if (!btn) return;
        cutState.effect = btn.dataset.fx;
        document.querySelectorAll('#cutEffects .capcut-chip').forEach((c) => c.classList.toggle('active', c === btn));
    });

    document.getElementById('cutMusicChips')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-music]');
        if (!btn) return;
        cutState.music = btn.dataset.music;
        document.querySelectorAll('#cutMusicChips .capcut-chip').forEach((c) => c.classList.toggle('active', c === btn));
        const video = document.getElementById('cutPreview');
        if (video && !video.paused) startCutMusic();
    });

    document.getElementById('cutRatios')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-ratio]');
        if (!btn) return;
        cutState.ratio = btn.dataset.ratio;
        document.querySelectorAll('#cutRatios .capcut-chip').forEach((c) => c.classList.toggle('active', c === btn));
        applyCutRatio();
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
    };
    bindRange('cutSpeed', 'speed', 'cutSpeedVal', (v) => `${v.toFixed(2)}x`);
    bindRange('cutBright', 'bright', 'cutBrightVal', (v) => v.toFixed(2));
    bindRange('cutContrast', 'contrast', 'cutContrastVal', (v) => v.toFixed(2));
    bindRange('cutSaturate', 'saturate', 'cutSaturateVal', (v) => v.toFixed(2));
    bindRange('cutMusicVol', 'musicVol', 'cutMusicVolVal', (v) => `${Math.round(v * 100)}%`);
    bindRange('cutVideoVol', 'videoVol', 'cutVideoVolVal', (v) => `${Math.round(v * 100)}%`);
    bindRange('cutTrimStart', 'trimStart', 'cutTrimStartVal', (v) => `${v.toFixed(1)}s`);
    bindRange('cutTrimEnd', 'trimEnd', 'cutTrimEndVal', (v) => `${v.toFixed(1)}s`);

    document.getElementById('cutCaption')?.addEventListener('input', applyCutCaption);

    document.getElementById('cutTimeline')?.addEventListener('click', (e) => {
        const video = document.getElementById('cutPreview');
        const tl = document.getElementById('cutTimeline');
        if (!video?.src || !tl || !cutDuration) return;
        const rect = tl.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        video.currentTime = ratio * cutDuration;
    });

    applyCutCaption();
    applyCutSpeed();
    applyCutVolumes();
    applyCutRatio();
    applyCutVisuals();
}
