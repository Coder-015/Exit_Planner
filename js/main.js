let app;

// Store initial state for AI phase retry
let initialMap = null;
let initialFireSet = null;
let initialPlayerStart = null;

let humanTime = 0;
let humanStatus = '';

function pushLog(msg, isAlert = false) {
    const ticker = document.getElementById('log-ticker');
    if (!ticker) return;
    const span = document.createElement('span');
    span.className = 'mx-8' + (isAlert ? ' text-secondary font-bold' : '');
    span.innerText = `[${new Date().toISOString().substring(11, 19)}] ${msg}`;
    ticker.appendChild(span);
    if (ticker.childElementCount > 15) {
        ticker.removeChild(ticker.firstChild);
    }
}

window.onload = () => {
    app = new Engine3D('canvas-container');

    app.onGameOver = (result, timeTaken) => {
        if (app.phase === 1) {
            // Human finished
            humanTime = timeTaken;
            humanStatus = result === 'Win' ? 'Escaped' : 'Trapped';
            document.getElementById('val-mode').innerText = `Human Phase Ended (${humanStatus})`;
            document.getElementById('ticker-status').innerText = `Status: ${humanStatus}`;
            pushLog(`HUMAN INTERVENTION COMPLETE. STATUS: ${humanStatus.toUpperCase()}`);
            
            // Auto-start AI Phase
            setTimeout(() => {
                startAiRun();
            }, 1500);
        } else if (app.phase === 2) {
            // AI finished
            pushLog(`AI SIMULATION COMPLETE. COST: ${app.metrics.pathCost || 0}`);
            showResultsModal(result, timeTaken);
        }
    };

    app.reset();
    document.getElementById('val-mode').innerText = 'Initializing...';
    pushLog("AEGIS TOPOGRAPHY SYSTEM ONLINE");
};

window.startSim = function() {
    initialMap = JSON.parse(JSON.stringify(app.map));
    initialFireSet = new Set(app.fireSet);
    initialPlayerStart = { ...app.player };

    const p1 = document.getElementById('phase1-badge');
    const p2 = document.getElementById('phase2-badge');
    
    p1.className = "flex-1 text-center py-2 border border-primary text-primary bg-primary/10";
    p2.className = "flex-1 text-center py-2 border border-outline-variant text-slate-500 bg-transparent";

    document.getElementById('ai-metrics').style.display = 'none';
    document.getElementById('val-mode').innerText = 'Human Phase Running';
    document.getElementById('human-instructions').style.display = 'block';

    pushLog("MANUAL OVERRIDE ENGAGED", true);
    app.startHumanPhase();
};

window.generateNewMap = function() {
    app.reset();
    document.getElementById('val-mode').innerText = 'New Map Generated! Ready to Start.';
    pushLog("NEW FACILITY TOPOGRAPHY RENDERED");
};

window.playIntroAnimation = function() {
    app.playIntro();
};

function startAiRun() {
    const p1 = document.getElementById('phase1-badge');
    const p2 = document.getElementById('phase2-badge');
    
    p1.className = "flex-1 text-center py-2 border border-outline-variant text-slate-500 bg-transparent";
    p2.className = "flex-1 text-center py-2 border border-primary text-primary bg-primary/10";
    
    document.getElementById('ai-metrics').style.display = 'block';
    document.getElementById('val-mode').innerText = 'AI Phase Running (A*)';
    document.getElementById('human-instructions').style.display = 'none';

    pushLog("A* ALGORITHM: PATHFINDING INITIALIZED");

    // Start
    app.startAiPhase(
        JSON.parse(JSON.stringify(initialMap)), 
        initialFireSet, 
        initialPlayerStart
    );
}

function showResultsModal(aiResult, aiTime) {
    const modal = document.getElementById('results-modal');
    modal.classList.remove('hidden');

    document.getElementById('res-human-time').innerText = humanTime.toFixed(1);
    
    const hStatus = document.getElementById('res-human-status');
    hStatus.innerText = humanStatus;
    hStatus.className = humanStatus === 'Escaped' ? "font-['Space_Grotesk'] text-sm font-bold text-tertiary" : "font-['Space_Grotesk'] text-sm font-bold text-secondary";

    document.getElementById('res-ai-time').innerText = aiTime.toFixed(1);
    const aiCost = app.metrics.pathCost || 0;
    const aiNodes = app.metrics.nodesExplored || 0;
    
    document.getElementById('res-ai-cost').innerText = aiCost;
    document.getElementById('res-ai-nodes').innerText = aiNodes;
    
    const title = document.getElementById('modal-title');
    if (aiResult === 'Win') {
        title.innerText = 'AI Navigation Successful';
        title.className = 'text-2xl font-bold font-["Space_Grotesk"] uppercase tracking-widest text-tertiary mb-6';
        pushLog("AI REACHED EXIT POINT DELTA");
    } else {
        title.innerText = 'AI Trapped By Hazard';
        title.className = 'text-2xl font-bold font-["Space_Grotesk"] uppercase tracking-widest text-secondary mb-6';
        pushLog("CRITICAL FAILURE: AI TRAPPED", true);
    }
}

window.closeModalAndReset = function() {
    const modal = document.getElementById('results-modal');
    modal.classList.add('hidden');
    app.reset(); // Generates new map for new game
    document.getElementById('val-mode').innerText = 'Ready to Start Phase 1';
    pushLog("FACILITY RESET. AWAITING COMMAND.");
};

window.toggleInfoModal = function() {
    const modal = document.getElementById('info-modal');
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        pushLog("ACCESSING PROJECT DOCUMENTATION...", true);
    } else {
        modal.classList.add('hidden');
    }
};

// --- AUDIO MANAGER ---
let bgmAudio = new Audio('audio/bgm.mp3');
bgmAudio.loop = true;
bgmAudio.volume = 0.2;

let aagAudio = new Audio('audio/aag.mp3');

window.toggleSettingsModal = function() {
    const modal = document.getElementById('settings-modal');
    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
    } else {
        modal.classList.add('hidden');
    }
};

window.updateAudioSettings = function() {
    const bgmToggle = document.getElementById('toggle-bgm').checked;
    
    if (bgmToggle) {
        bgmAudio.play().catch(e => pushLog("BGM ENGAGEMENT FAILED (FILE MISSING)", true));
    } else {
        bgmAudio.pause();
    }
};

window.triggerAagMeme = function() {
    const aagToggle = document.getElementById('toggle-aag').checked;
    if (aagToggle) {
        const wasBgmPlaying = !bgmAudio.paused && document.getElementById('toggle-bgm').checked;
        
        if (wasBgmPlaying) {
            gsap.to(bgmAudio, { volume: 0, duration: 0.5, onComplete: () => bgmAudio.pause() });
        }
        
        aagAudio.currentTime = 0;
        aagAudio.play().catch(e => pushLog("AAG AUDIO MISSING", true));
        pushLog("AAG PROTOCOL AUDITORY OVERRIDE ACTIVATED", true);
        
        aagAudio.onended = () => {
            if (wasBgmPlaying && document.getElementById('toggle-bgm').checked) {
                bgmAudio.play();
                gsap.to(bgmAudio, { volume: 0.2, duration: 1.0 });
            }
        };
    }
};
