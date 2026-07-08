/* MAGNOMCUT editor — images + videos */

let cutObjectUrl = null;
let cutImportedFile = null;
let cutDuration = 0;
let cutMediaKind = null; // 'video' | 'image'
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

const CUT_FILTER_MAP = {
    none: '',
    gold: 'saturate(1.25) contrast(1.08) sepia(0.28) hue-rotate(-8deg)',
    neon: 'saturate(1.45) contrast(1.15) brightness(1.05) hue-rotate(150deg)',
    heat: 'saturate(1.4) contrast(1.2) sepia(0.35) hue-rotate(-25deg)',
    ice: 'saturate(0.85) contrast(1.1) brightness(1.08) hue-rotate(180deg)',
    cinema: 'contrast(1.25) saturate(0.9) brightness(0.92)',
    retro: 'sepia(0.45) contrast(1.15) saturate(1.2)',
    glow: 'brightness(1.15) contrast(1.2) saturate(1.35)',
};

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

function openCapcutPanel(name) {
    if (cutMediaKind === 'image' && (name === 'audio' || name === 'speed' || name === 'trim')) {
        name = 'media';
        setCutStatus(typeof tx === 'function' ? tx('cut.imageModeHint') : 'Audio, speed, and trim are for videos.');
    }
    document.querySelectorAll('#capcutDock .capcut-dock-btn').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.panel === name);
    });
    document.querySelectorAll('.capcut-panel').forEach((panel) => {
        panel.classList.toggle('active', panel.dataset.panel === name);
    });
    const title = document.getElementById('capcutSideTitle');
    if (title) title.textContent = name.charAt(0).toUpperCase() + name.slice(1);
}

function setCutMediaVisibility() {
    const video = document.getElementById('cutPreview');
    const image = document.getElementById('cutImagePreview');
    if (video) {
        const showVideo = cutMediaKind === 'video';
        video.classList.toggle('is-shown', showVideo);
        video.toggleAttribute('hidden', !showVideo);
        video.style.display = showVideo ? 'block' : 'none';
        if (!showVideo) {
            video.pause?.();
            video.removeAttribute('src');
            try { video.load?.(); } catch { /* ignore */ }
        }
    }
    if (image) {
        const showImage = cutMediaKind === 'image';
        image.classList.toggle('is-shown', showImage);
        image.toggleAttribute('hidden', !showImage);
        image.style.display = showImage ? 'block' : 'none';
        if (!showImage) image.removeAttribute('src');
    }
}

function syncCutModeUI() {
    const studio = document.getElementById('magnomCutStudio');
    if (studio) {
        studio.dataset.media = cutMediaKind || '';
        studio.classList.toggle('is-image', cutMediaKind === 'image');
        studio.classList.toggle('is-video', cutMediaKind === 'video');
    }
    setCutMediaVisibility();
    document.querySelectorAll('#capcutDock .capcut-dock-btn').forEach((btn) => {
        const videoOnly = btn.dataset.videoOnly === '1';
        btn.disabled = cutMediaKind === 'image' && videoOnly;
        btn.classList.toggle('disabled', btn.disabled);
    });
    const transport = document.querySelector('.capcut-transport');
    if (transport) transport.style.opacity = cutMediaKind === 'image' ? '0.45' : '1';
    const playTop = document.getElementById('cutPlayBtn');
    if (playTop) playTop.style.display = cutMediaKind === 'image' ? 'none' : '';
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
        el.classList.toggle('filter-gold', cutState.filter === 'gold');
        el.classList.toggle('filter-neon', cutState.filter === 'neon');
        el.classList.toggle('filter-heat', cutState.filter === 'heat');
        el.classList.toggle('filter-ice', cutState.filter === 'ice');
        el.classList.toggle('filter-cinema', cutState.filter === 'cinema');
        el.classList.toggle('filter-retro', cutState.filter === 'retro');
        el.classList.toggle('filter-glow', cutState.filter === 'glow');
    });
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

function setCutSpeed(v) {
    if (cutMediaKind === 'image') return;
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
    } else if (range && cutMediaKind === 'image') {
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

function handleCutImport(e) {
    const file = e.target.files?.[0];
    const hint = document.getElementById('cutEmptyHint');
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

    document.getElementById('cutMediaName').textContent = `${file.name} · ${cutMediaKind}`;
    const project = document.getElementById('cutProjectName');
    if (project && !project.value.trim()) {
        project.value = file.name.replace(/\.[^.]+$/, '');
    }
    if (hint) {
        hint.classList.add('hidden');
        hint.style.display = 'none';
    }

    if (cutMediaKind === 'image') {
        const image = document.getElementById('cutImagePreview');
        const video = document.getElementById('cutPreview');
        if (video) {
            video.pause?.();
            video.removeAttribute('src');
            video.style.display = 'none';
            video.classList.remove('is-shown');
            video.setAttribute('hidden', '');
        }
        if (image) {
            image.onload = () => {
                const label = document.getElementById('cutTimeLabel');
                if (label) label.textContent = 'IMAGE';
                const head = document.getElementById('cutPlayhead');
                if (head) head.style.left = '0%';
                updateCutTrimUI();
                applyCutVisuals();
            };
            image.onerror = () => {
                setCutStatus('Could not load this image. Try JPG or PNG.');
                notify('Could not load this image. Try JPG or PNG.', true);
            };
            // Set visibility before src so the frame paints as soon as bytes arrive
            image.removeAttribute('hidden');
            image.classList.add('is-shown', 'capcut-filter-preview');
            image.style.display = 'block';
            image.style.visibility = 'visible';
            image.style.opacity = '1';
            image.src = cutObjectUrl;
        }
        syncCutModeUI();
        setCutStatus(typeof tx === 'function' ? tx('cut.readyImage') : 'Image imported — edit with MAGNOMCUT tools.');
    } else {
        const video = document.getElementById('cutPreview');
        const image = document.getElementById('cutImagePreview');
        if (image) {
            image.removeAttribute('src');
            image.style.display = 'none';
            image.classList.remove('is-shown');
            image.setAttribute('hidden', '');
        }
        if (video) {
            video.removeAttribute('hidden');
            video.classList.add('is-shown', 'capcut-filter-preview');
            video.style.display = 'block';
            video.src = cutObjectUrl;
            video.load();
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
        }
        syncCutModeUI();
        cutRaf = requestAnimationFrame(syncCutTransport);
        setCutStatus(typeof tx === 'function' ? tx('cut.ready') : 'Video imported — use the MAGNOMCUT tool dock.');
    }

    applyCutVisuals();
    applyCutSpeed();
    applyCutCaption();
    applyCutSticker();
    applyCutVolumes();
    applyCutRatio();
    openCapcutPanel('media');
}

function toggleCutPlayback() {
    if (cutMediaKind === 'image') {
        notify(typeof tx === 'function' ? tx('cut.imageModeHint') : 'Playback is for videos. Export the image when ready.', true);
        return;
    }
    const video = document.getElementById('cutPreview');
    if (!video?.src) {
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
        try {
            cutMusicNodes.osc.forEach((o) => o.stop());
        } catch {
            /* ignore */
        }
        try {
            cutMusicNodes.gain.disconnect();
        } catch {
            /* ignore */
        }
        cutMusicNodes = null;
    }
}

function startCutMusic() {
    stopCutMusic();
    if (cutState.music === 'none' || cutMediaKind !== 'video') return;
    const ctx = ensureCutAudio();
    if (!ctx) return;
    const gain = ctx.createGain();
    gain.gain.value = cutState.musicVol;
    gain.connect(ctx.destination);
    const beds = {
        pulse: [110, 165, 220],
        boost: [98, 147, 196, 294],
        clutch: [82, 123, 164, 246],
    };
    const freqs = beds[cutState.music] || beds.pulse;
    const osc = freqs.map((f, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = i % 2 ? 'triangle' : 'sine';
        o.frequency.value = f;
        g.gain.value = 0.05 / freqs.length;
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
    const media = getCutPreviewEl();
    const flash = document.getElementById('cutFxFlash');
    const inner = document.getElementById('cutPreviewInner');
    if (!media?.src && !media?.currentSrc) {
        notify(cutNeedMediaMsg(), true);
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
    if (cutState.effect === 'glitch' && media) {
        media.animate(
            [
                { filter: media.style.filter },
                { filter: `${media.style.filter} hue-rotate(80deg)` },
                { filter: media.style.filter },
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

function cutCanvasSize() {
    const w = cutState.ratio === '16x9' ? 1280 : cutState.ratio === '1x1' ? 720 : 720;
    const h = cutState.ratio === '16x9' ? 720 : cutState.ratio === '1x1' ? 720 : 1280;
    return { w, h };
}

function drawCutOverlays(ctx, w, h) {
    const caption = document.getElementById('cutCaption')?.value.trim() || '';
    if (caption) {
        ctx.textAlign = 'center';
        ctx.font = `800 ${Math.round(w * 0.06)}px Oxanium, sans-serif`;
        if (cutState.textStyle === 'gold') {
            ctx.fillStyle = '#F0B429';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 8;
            ctx.fillText(caption, w / 2, h * 0.84);
        } else if (cutState.textStyle === 'neon') {
            ctx.fillStyle = '#5EEAD4';
            ctx.shadowColor = 'rgba(94,234,212,0.8)';
            ctx.shadowBlur = 16;
            ctx.fillText(caption, w / 2, h * 0.84);
        } else if (cutState.textStyle === 'impact') {
            ctx.fillStyle = '#fff';
            ctx.lineWidth = 4;
            ctx.strokeStyle = '#111';
            ctx.strokeText(caption.toUpperCase(), w / 2, h * 0.84);
            ctx.fillText(caption.toUpperCase(), w / 2, h * 0.84);
        } else if (cutState.textStyle === 'bubble') {
            const metrics = ctx.measureText(caption);
            const bw = metrics.width + 36;
            const bh = Math.round(w * 0.08);
            ctx.fillStyle = '#F0B429';
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(w / 2 - bw / 2, h * 0.78, bw, bh, 999);
                ctx.fill();
            } else {
                ctx.fillRect(w / 2 - bw / 2, h * 0.78, bw, bh);
            }
            ctx.fillStyle = '#111';
            ctx.shadowBlur = 0;
            ctx.fillText(caption, w / 2, h * 0.78 + bh * 0.72);
        } else {
            ctx.fillStyle = '#fff';
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur = 10;
            ctx.fillText(caption, w / 2, h * 0.84);
        }
        ctx.shadowBlur = 0;
    }
    if (cutState.sticker) {
        ctx.font = `${Math.round(w * 0.12)}px sans-serif`;
        ctx.shadowBlur = 0;
        ctx.fillText(cutState.sticker, w * 0.82, h * 0.18);
    }
}

function drawCutMediaFrame(ctx, source, w, h, filterCss) {
    ctx.filter = filterCss || 'none';
    const sw = source.videoWidth || source.naturalWidth || w;
    const sh = source.videoHeight || source.naturalHeight || h;
    const scale = Math.max(w / sw, h / sh);
    const dw = sw * scale;
    const dh = sh * scale;
    const dx = (w - dw) / 2;
    const dy = (h - dh) / 2;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(source, dx, dy, dw, dh);
    ctx.filter = 'none';
}

async function exportCutImage() {
    const image = document.getElementById('cutImagePreview');
    if (!image?.src) throw new Error('No image');
    if (!image.complete) {
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error('Image failed to load'));
            setTimeout(resolve, 800);
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
    const end = cutState.trimEnd > start ? cutState.trimEnd : (cutDuration || video.duration || 0);
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
    if (!media?.src && !media?.currentSrc) {
        notify(cutNeedMediaMsg(), true);
        return;
    }
    const projectName = document.getElementById('cutProjectName')?.value.trim()
        || document.getElementById('cutCaption')?.value.trim()
        || cutImportedFile.name.replace(/\.[^.]+$/, '')
        || 'MAGNOMCUT';
    const progress = document.getElementById('cutExportProgress');
    const safeName = projectName.replace(/\s+/g, '_');

    try {
        if (progress) progress.textContent = cutMediaKind === 'image' ? 'Rendering image…' : 'Rendering video…';
        setCutStatus('Exporting MAGNOMCUT project…');

        let outFile;
        if (cutMediaKind === 'image') {
            const blob = await exportCutImage();
            outFile = new File([blob], `${safeName}.png`, { type: 'image/png' });
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
        if (!btn || btn.disabled) return;
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
        if (video && !video.paused && cutMediaKind === 'video') startCutMusic();
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
        if (cutMediaKind !== 'video') return;
        const video = document.getElementById('cutPreview');
        const tl = document.getElementById('cutTimeline');
        if (!video?.src || !tl || !cutDuration) return;
        const rect = tl.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
        video.currentTime = ratio * cutDuration;
    });

    syncCutModeUI();
    applyCutCaption();
    applyCutSpeed();
    applyCutVolumes();
    applyCutRatio();
    applyCutVisuals();
}
