let app;

// Store initial state for AI phase retry
let initialMap = null;
let initialFireSet = null;
let initialPlayerStart = null;

let humanTime = 0;
let humanStatus = '';

window.onload = () => {
    app = new Engine3D('canvas-container');

    app.onGameOver = (result, timeTaken) => {
        if (app.phase === 1) {
            // Human finished
            humanTime = timeTaken;
            humanStatus = result === 'Win' ? 'Escaped' : 'Trapped';
            document.getElementById('val-mode').innerText = `Human Phase Ended (${humanStatus})`;
            
            // Auto-start AI Phase
            setTimeout(() => {
                startAiRun();
            }, 1000);
        } else if (app.phase === 2) {
            // AI finished
            showResultsModal(result, timeTaken);
        }
    };

    app.reset();
    document.getElementById('val-mode').innerText = 'Initializing...';
};

window.startSim = function() {
    // Start simulation using the currently generated map!
    
    // Lock in state for AI to reuse identically
    initialMap = JSON.parse(JSON.stringify(app.map));
    initialFireSet = new Set(app.fireSet);
    initialPlayerStart = { ...app.player };

    // Update UI
    document.getElementById('phase1-badge').classList.add('active');
    document.getElementById('phase2-badge').classList.remove('active');
    document.getElementById('ai-metrics').style.display = 'none';
    document.getElementById('val-mode').innerText = 'Human Phase Running';
    document.getElementById('human-instructions').style.display = 'block';

    app.startHumanPhase();
};

window.generateNewMap = function() {
    app.reset();
    document.getElementById('val-mode').innerText = 'New Map Generated! Ready to Start.';
};

window.playIntroAnimation = function() {
    app.playIntro();
};

function startAiRun() {
    // Reset engine using saved state from start of human run
    document.getElementById('phase1-badge').classList.remove('active');
    document.getElementById('phase2-badge').classList.add('active');
    document.getElementById('ai-metrics').style.display = 'block';
    document.getElementById('val-mode').innerText = 'AI Phase Running (A*)';
    document.getElementById('human-instructions').style.display = 'none';

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
    modal.style.pointerEvents = 'auto';

    document.getElementById('res-human-time').innerText = humanTime.toFixed(1);
    document.getElementById('res-human-status').innerText = humanStatus;
    
    document.getElementById('res-ai-time').innerText = aiTime.toFixed(1);
    const aiCost = app.metrics.pathCost || 0;
    const aiNodes = app.metrics.nodesExplored || 0;
    const aiNodesBfs = app.metrics.nodesExploredBFS || 0;
    
    document.getElementById('res-ai-cost').innerText = aiCost;
    document.getElementById('res-ai-nodes').innerText = aiNodes;
    document.getElementById('res-ai-nodes-bfs').innerText = aiNodesBfs;
    
    const title = document.getElementById('modal-title');
    if (aiResult === 'Win') {
        title.innerText = 'AI Successfully Navigated!';
        title.className = 'glow-text_green';
    } else {
        title.innerText = 'AI was Trapped by Fire!';
        title.className = 'glow-text_red';
    }
}

window.closeModalAndReset = function() {
    const modal = document.getElementById('results-modal');
    modal.classList.add('hidden');
    modal.style.pointerEvents = 'none';
    app.reset(); // Generates new map for new game
    document.getElementById('val-mode').innerText = 'Ready to Start Phase 1';
};
