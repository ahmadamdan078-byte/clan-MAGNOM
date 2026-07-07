/* MAGNOM Clan — live voice for admin support calls (WebRTC) */

const SUPPORT_RTC_CONFIG = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
    ],
};

const supportRtc = {
    entryId: null,
    entry: null,
    pc: null,
    localStream: null,
    isInitiator: false,
    signalPoll: null,
    lastSignalId: 0,
    muted: false,
    status: 'idle', // idle | connecting | connected | error
};

function supportCallTx(key, fallback) {
    return typeof t === 'function' ? t(key) : fallback;
}

function getSupportRemoteAudio() {
    return document.getElementById('supportRemoteAudio');
}

function updateSupportVoiceBar() {
    const bar = document.getElementById('supportVoiceBar');
    const statusEl = document.getElementById('supportVoiceStatus');
    const peerEl = document.getElementById('supportVoicePeer');
    const muteBtn = document.getElementById('supportVoiceMuteBtn');
    if (!bar) return;

    if (!supportRtc.entryId || supportRtc.status === 'idle') {
        bar.style.display = 'none';
        bar.hidden = true;
        document.body.classList.remove('support-call-active');
        return;
    }

    bar.style.display = 'flex';
    bar.hidden = false;
    document.body.classList.add('support-call-active');
    const entry = supportRtc.entry || {};
    const peerName = typeof currentUser !== 'undefined' && currentUser
        && entry.adminId === currentUser.id
        ? entry.username
        : (entry.adminUsername || entry.username || 'Support');

    if (peerEl) peerEl.textContent = peerName;

    const statusText = {
        connecting: supportCallTx('support.voiceConnecting', 'Connecting voice…'),
        connected: supportCallTx('support.voiceConnected', 'Voice call live — speak now'),
        error: supportCallTx('support.voiceError', 'Voice connection failed'),
    };
    if (statusEl) {
        statusEl.textContent = statusText[supportRtc.status] || statusText.connecting;
        statusEl.className = 'support-voice-status ' + supportRtc.status;
    }
    if (muteBtn) {
        muteBtn.textContent = supportRtc.muted
            ? supportCallTx('support.unmute', 'Unmute')
            : supportCallTx('support.mute', 'Mute');
    }
}

async function postSupportSignal(entryId, type, payload) {
    await supportQueueApi(`/api/support-queue/${entryId}/signals`, {
        method: 'POST',
        body: JSON.stringify({ type, payload }),
    });
}

async function pollSupportSignals() {
    if (!supportRtc.entryId || !supportRtc.pc) return;
    try {
        const data = await supportQueueApi(
            `/api/support-queue/${supportRtc.entryId}/signals?after=${supportRtc.lastSignalId}`
        );
        const signals = data.signals || [];
        for (const sig of signals) {
            supportRtc.lastSignalId = Math.max(supportRtc.lastSignalId, sig.id);
            await handleSupportSignal(sig);
        }
        if (data.latestId != null) {
            supportRtc.lastSignalId = Math.max(supportRtc.lastSignalId, data.latestId);
        }
    } catch { /* retry next poll */ }
}

async function handleSupportSignal(sig) {
    const pc = supportRtc.pc;
    if (!pc) return;

    if (sig.type === 'offer' && !supportRtc.isInitiator) {
        await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await postSupportSignal(supportRtc.entryId, 'answer', pc.localDescription);
    } else if (sig.type === 'answer' && supportRtc.isInitiator) {
        if (!pc.currentRemoteDescription) {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload));
        }
    } else if (sig.type === 'ice' && sig.payload) {
        try {
            await pc.addIceCandidate(new RTCIceCandidate(sig.payload));
        } catch { /* duplicate or late candidate */ }
    }
}

async function startSupportVoiceCall(entryId, isInitiator, entry) {
    if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia) {
        if (typeof notify === 'function') {
            notify(supportCallTx('support.voiceUnsupported', 'Voice calls not supported in this browser'), true);
        }
        return;
    }
    if (supportRtc.entryId === entryId && supportRtc.pc) return;

    await stopSupportVoiceCall(false);

    supportRtc.entryId = entryId;
    supportRtc.entry = entry || null;
    supportRtc.isInitiator = isInitiator;
    supportRtc.lastSignalId = 0;
    supportRtc.status = 'connecting';
    supportRtc.muted = false;
    updateSupportVoiceBar();

    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video: false,
        });
        supportRtc.localStream = stream;

        const pc = new RTCPeerConnection(SUPPORT_RTC_CONFIG);
        supportRtc.pc = pc;

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                postSupportSignal(entryId, 'ice', event.candidate.toJSON()).catch(() => {});
            }
        };

        pc.ontrack = (event) => {
            const audio = getSupportRemoteAudio();
            if (audio && event.streams[0]) {
                audio.srcObject = event.streams[0];
                audio.play().catch(() => {
                    const btn = document.getElementById('supportVoiceEnableBtn');
                    if (btn) btn.style.display = 'inline-flex';
                });
            }
            supportRtc.status = 'connected';
            updateSupportVoiceBar();
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'connected') {
                supportRtc.status = 'connected';
                updateSupportVoiceBar();
            } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                supportRtc.status = 'error';
                updateSupportVoiceBar();
            }
        };

        if (isInitiator) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            await postSupportSignal(entryId, 'offer', pc.localDescription);
        }

        supportRtc.signalPoll = setInterval(pollSupportSignals, 1000);
        pollSupportSignals();
    } catch (err) {
        supportRtc.status = 'error';
        updateSupportVoiceBar();
        const msg = err?.name === 'NotAllowedError'
            ? supportCallTx('support.micDenied', 'Microphone permission denied — allow mic access to talk')
            : (err.message || supportCallTx('support.voiceError', 'Voice connection failed'));
        if (typeof notify === 'function') notify(msg, true);
    }
}

async function stopSupportVoiceCall(resetEntry = true) {
    document.body.classList.remove('support-call-active');
    if (supportRtc.signalPoll) {
        clearInterval(supportRtc.signalPoll);
        supportRtc.signalPoll = null;
    }
    if (supportRtc.pc) {
        supportRtc.pc.onicecandidate = null;
        supportRtc.pc.ontrack = null;
        supportRtc.pc.close();
        supportRtc.pc = null;
    }
    if (supportRtc.localStream) {
        supportRtc.localStream.getTracks().forEach((t) => t.stop());
        supportRtc.localStream = null;
    }
    const audio = getSupportRemoteAudio();
    if (audio) {
        audio.srcObject = null;
    }
    const enableBtn = document.getElementById('supportVoiceEnableBtn');
    if (enableBtn) enableBtn.style.display = 'none';

    if (resetEntry) {
        supportRtc.entryId = null;
        supportRtc.entry = null;
        supportRtc.isInitiator = false;
        supportRtc.lastSignalId = 0;
        supportRtc.status = 'idle';
        supportRtc.muted = false;
    }
    updateSupportVoiceBar();
}

function toggleSupportMute() {
    supportRtc.muted = !supportRtc.muted;
    if (supportRtc.localStream) {
        supportRtc.localStream.getAudioTracks().forEach((t) => {
            t.enabled = !supportRtc.muted;
        });
    }
    updateSupportVoiceBar();
}

function enableSupportRemoteAudio() {
    const audio = getSupportRemoteAudio();
    if (audio) {
        audio.play().then(() => {
            const btn = document.getElementById('supportVoiceEnableBtn');
            if (btn) btn.style.display = 'none';
        }).catch(() => {});
    }
}

function getMyActiveSupportCallEntry() {
    if (typeof currentUser === 'undefined' || !currentUser) return null;
    const mine = typeof supportQueueData !== 'undefined' ? supportQueueData.mine : null;
    if (mine?.status === 'active') return mine;
    if (typeof isAdmin === 'function' && isAdmin() && typeof supportQueueData !== 'undefined') {
        return (supportQueueData.active || []).find((e) => e.adminId === currentUser.id) || null;
    }
    return null;
}

function ensureSupportVoiceCall() {
    const entry = getMyActiveSupportCallEntry();
    if (!entry) {
        stopSupportVoiceCall(true);
        return;
    }
    if (supportRtc.entryId === entry.id && supportRtc.pc) {
        supportRtc.entry = entry;
        updateSupportVoiceBar();
        return;
    }
    const isInitiator = entry.adminId === currentUser.id;
    startSupportVoiceCall(entry.id, isInitiator, entry);
}
