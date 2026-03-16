class Engine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        
        this.gridSize = 40; // 40x40 grid
        this.cellSize = this.canvas.width / this.gridSize; // 20px
        
        this.map = null;
        this.player = { x: 0, y: 0 };
        this.fireSet = new Set(); // Stores string "x,y"
        this.exits = [];
        
        this.phase = 1; // 1 = Human, 2 = AI
        this.isPlaying = false;
        this.startTime = 0;
        this.elapsedTime = 0;
        
        this.fireSpreadRateMs = 2000;
        this.lastFireTime = 0;
        
        // AI specific
        this.aiPath = [];
        this.aiExploredSet = new Set();
        this.aiPathIndex = 0;
        this.lastAiMoveTime = 0;
        
        this.metrics = {
            nodesExplored: 0,
            nodesExploredBFS: 0, // Comparing the unoptimized approach
            pathCost: 0,
            computeTime: 0
        };

        this.bindInput();
    }

    reset(keepMap = false) {
        if (!keepMap) {
            const mg = new MapGenerator(this.gridSize, this.gridSize);
            const data = mg.generate();
            this.map = data.grid;
            this.player = { ...data.playerSpawn };
            this.exits = [...data.exits];
            this.fireSet.clear();
            
            // Spawn initial localized fires (away from player)
            for (let i = 0; i < 3; i++) {
                this.spawnRandomFire();
            }
        }
        
        this.isPlaying = false;
        this.elapsedTime = 0;
        this.aiPath = [];
        this.aiExploredSet.clear();
        this.aiPathIndex = 0;
        this.lastAiMoveTime = 0;
        this.lastFireTime = performance.now();
        this.startTime = performance.now();

        this.draw();
    }

    startHumanPhase() {
        this.phase = 1;
        this.isPlaying = true;
        this.startTime = performance.now();
        this.lastFireTime = performance.now();
        requestAnimationFrame((t) => this.loop(t));
    }

    startAiPhase(gridCopy, fireSetCopy, playerStart) {
        this.phase = 2;
        this.map = gridCopy;
        this.fireSet = new Set(fireSetCopy);
        this.player = { ...playerStart };
        this.isPlaying = true;
        this.startTime = performance.now();
        this.lastFireTime = performance.now();
        this.lastAiMoveTime = performance.now();
        
        // Compute path utilizing AI
        const startState = performance.now();
        const result = AI.aStar(this.map, this.player, this.exits, this.fireSet);
        const endState = performance.now();
        
        // Compute BFS purely for comparison
        const resultBfs = AI.bfs(this.map, this.player, this.exits, this.fireSet);
        this.metrics.nodesExploredBFS = resultBfs.nodesExplored;

        if (result.path) {
            this.aiPath = result.path;
            this.metrics.pathCost = result.path.length;
        } else {
            this.aiPath = [];
            this.metrics.pathCost = 0;
        }
        this.aiExploredSet = result.explored || new Set();
        this.metrics.nodesExplored = result.nodesExplored || 0;
        this.metrics.computeTime = (endState - startState).toFixed(2);
        
        this.updateUI();
        requestAnimationFrame((t) => this.loop(t));
    }

    spawnRandomFire() {
        let placed = false;
        let attempts = 0;
        while (!placed && attempts < 100) {
            const x = Math.floor(Math.random() * this.gridSize);
            const y = Math.floor(Math.random() * this.gridSize);
            // Valid if floor, far from player
            const dist = Math.abs(x - this.player.x) + Math.abs(y - this.player.y);
            if (this.map[y][x] === 0 && dist > 10) {
                this.fireSet.add(`${x},${y}`);
                placed = true;
            }
            attempts++;
        }
    }

    spreadFire() {
        const newFire = new Set(this.fireSet);
        const directions = [[0,1],[1,0],[0,-1],[-1,0]];
        
        for (const loc of this.fireSet) {
            const [fx, fy] = loc.split(',').map(Number);
            
            for (const [dx, dy] of directions) {
                const nx = fx + dx;
                const ny = fy + dy;
                
                if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                    if (this.map[ny][nx] === 0 && Math.random() < 0.3) {
                        newFire.add(`${nx},${ny}`);
                    }
                }
            }
        }
        this.fireSet = newFire;
        
        // AI Phase: Reroute if path is blocked!
        if (this.phase === 2 && this.isPlaying && this.aiPath.length > 0) {
            // Check if upcoming path has fire
            let blocked = false;
            for (let i = this.aiPathIndex; i < this.aiPath.length; i++) {
                const node = this.aiPath[i];
                if (this.fireSet.has(`${node.x},${node.y}`)) {
                    blocked = true;
                    break;
                }
            }
            
            if (blocked) {
                // Recompute A* from current position!
                const result = AI.aStar(this.map, this.player, this.exits, this.fireSet);
                if (result.path) {
                    this.aiPath = result.path;
                    this.aiPathIndex = 0; 
                    // Add new explored to the visualization
                    result.explored.forEach(e => this.aiExploredSet.add(e));
                } else {
                    this.aiPath = []; // Trapped
                }
            }
        }
    }

    bindInput() {
        window.addEventListener('keydown', (e) => {
            if (this.phase !== 1 || !this.isPlaying) return;
            
            let dx = 0, dy = 0;
            if (e.key === 'ArrowUp' || e.key === 'w') dy = -1;
            else if (e.key === 'ArrowDown' || e.key === 's') dy = 1;
            else if (e.key === 'ArrowLeft' || e.key === 'a') dx = -1;
            else if (e.key === 'ArrowRight' || e.key === 'd') dx = 1;
            else return;
            
            this.movePlayer(dx, dy);
        });
    }

    movePlayer(dx, dy) {
        const nx = this.player.x + dx;
        const ny = this.player.y + dy;
        
        if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
            if (this.map[ny][nx] !== 1) { // Not a wall
                this.player.x = nx;
                this.player.y = ny;
                
                this.checkWinLoss();
                this.draw();
            }
        }
    }

    checkWinLoss() {
        if (!this.isPlaying) return;

        // Check if on fire
        if (this.fireSet.has(`${this.player.x},${this.player.y}`)) {
            this.isPlaying = false;
            if (this.onGameOver) this.onGameOver('Loss', this.elapsedTime);
            return; // Dead
        }
        
        // Check if on exit
        for (const ex of this.exits) {
            if (this.player.x === ex.x && this.player.y === ex.y) {
                this.isPlaying = false;
                if (this.onGameOver) this.onGameOver('Win', this.elapsedTime);
                return;
            }
        }
    }

    loop(timestamp) {
        if (!this.isPlaying) return;
        
        this.elapsedTime = (timestamp - this.startTime) / 1000;
        
        // Fire Spread Logic
        if (timestamp - this.lastFireTime > this.fireSpreadRateMs) {
            this.spreadFire();
            this.lastFireTime = timestamp;
            // Immediate check incase fire spawned on player
            this.checkWinLoss();
        }

        // AI Movement Logic
        if (this.phase === 2) {
            if (timestamp - this.lastAiMoveTime > 150) { // Move every 150ms
                if (this.aiPathIndex < this.aiPath.length) {
                    const nextNode = this.aiPath[this.aiPathIndex];
                    this.player.x = nextNode.x;
                    this.player.y = nextNode.y;
                    this.aiPathIndex++;
                    this.lastAiMoveTime = timestamp;
                    this.checkWinLoss();
                } else if (this.aiPath.length === 0) {
                    // Check if AI is totally trapped
                    this.isPlaying = false;
                    if (this.onGameOver) this.onGameOver('Loss', this.elapsedTime);
                }
            }
        }

        this.updateUI();
        this.draw();
        
        if (this.isPlaying) {
            requestAnimationFrame((t) => this.loop(t));
        }
    }

    updateUI() {
        document.getElementById('val-timer').innerText = this.elapsedTime.toFixed(1) + 's';
        
        if (this.phase === 2) {
            document.getElementById('val-nodes').innerText = this.metrics.nodesExplored;
            document.getElementById('val-nodes-bfs').innerText = this.metrics.nodesExploredBFS;
            document.getElementById('val-cost').innerText = this.metrics.pathCost;
            document.getElementById('val-compute-time').innerText = this.metrics.computeTime + 'ms';
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const cs = this.cellSize;
        
        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const cell = this.map[y][x];
                
                // Base colors
                if (cell === 1) { // Wall
                    this.ctx.fillStyle = '#3d4a5d';
                    this.ctx.fillRect(x * cs, y * cs, cs, cs);
                } else if (cell === 2) { // Exit
                    // Exits rendered later so they sit on top and glow
                } else {
                    this.ctx.fillStyle = '#10151f';
                    this.ctx.fillRect(x * cs, y * cs, cs, cs);
                    
                    // Grid lines (subtle)
                    this.ctx.strokeStyle = 'rgba(255,255,255,0.03)';
                    this.ctx.strokeRect(x * cs, y * cs, cs, cs);
                }
            }
        }

        // Draw Explored Space (AI Phase only)
        if (this.phase === 2) {
            this.ctx.fillStyle = 'rgba(248, 197, 28, 0.2)';
            for (const loc of this.aiExploredSet) {
                const [ex, ey] = loc.split(',').map(Number);
                if (this.map[ey][ex] !== 1) { // Ensure not drawing over walls visually
                     this.ctx.fillRect(ex * cs, ey * cs, cs, cs);
                }
            }

            // Draw Computed AI Path line
            if (this.aiPath.length > 0) {
                this.ctx.strokeStyle = '#f8c51c';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(this.player.x * cs + cs/2, this.player.y * cs + cs/2);
                for (let i = this.aiPathIndex; i < this.aiPath.length; i++) {
                    const node = this.aiPath[i];
                    this.ctx.lineTo(node.x * cs + cs/2, node.y * cs + cs/2);
                }
                this.ctx.stroke();
            }
        }

        // Draw Fire
        this.ctx.fillStyle = '#ff4b4b';
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#ff4b4b';
        for (const loc of this.fireSet) {
            const [fx, fy] = loc.split(',').map(Number);
            
            // Core fire
            this.ctx.fillRect(Math.floor(fx * cs) + 2, Math.floor(fy * cs) + 2, cs - 4, cs - 4);
            
            // Inner yellow flame
            this.ctx.fillStyle = '#ffb347';
            this.ctx.fillRect(Math.floor(fx * cs) + Math.floor(cs/4), Math.floor(fy * cs) + Math.floor(cs/4), cs/2, cs/2);
            this.ctx.fillStyle = '#ff4b4b'; // Reset for next iteration
        }
        this.ctx.shadowBlur = 0; // Reset shadow

        // Draw Exits
        this.ctx.fillStyle = '#3fb950';
        this.ctx.shadowBlur = 20;
        this.ctx.shadowColor = '#3fb950';
        for (const ex of this.exits) {
            this.ctx.fillRect(ex.x * cs, ex.y * cs, cs, cs);
            // Draw exit icon/text
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = 'bold 12px Inter';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText("EXIT", ex.x * cs + cs/2, ex.y * cs + cs/2);
            this.ctx.fillStyle = '#3fb950'; // Reset
        }
        this.ctx.shadowBlur = 0;

        // Draw Player Focus Glow
        let playerColor = this.phase === 1 ? '#2f81f7' : '#f8c51c';
        
        this.ctx.beginPath();
        this.ctx.arc(this.player.x * cs + cs/2, this.player.y * cs + cs/2, cs/2.5, 0, Math.PI * 2);
        this.ctx.fillStyle = playerColor;
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = playerColor;
        this.ctx.fill();
        this.ctx.shadowBlur = 0;
    }
}
