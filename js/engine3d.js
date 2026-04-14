class Engine3D {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        
        // Setup Three.js Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color('#05080f');
        this.scene.fog = new THREE.FogExp2('#05080f', 0.02);
        
        // Setup Camera
        const aspect = window.innerWidth / window.innerHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        
        // Setup Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.container.appendChild(this.renderer.domElement);
        
        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.maxPolarAngle = Math.PI / 2.1; // Don't go below ground
        
        // Prevent OrbitControls from eating arrow keys/WASD
        if (this.controls.listenToKeyEvents) {
            this.controls.listenToKeyEvents(window); // Or null to disable entirely
            this.controls.enableKeys = false; // older versions
        }
        
        // Handle Resize
        window.addEventListener('resize', () => {
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(window.innerWidth, window.innerHeight);
        });
        
        // Game State Variables
        this.gridSize = 30; // 30x30 to keep 3D performant and dense
        this.cellSize = 2; // Real world units
        this.map = null;
        this.player = { x: 0, y: 0 };
        this.fireSet = new Set();
        this.exits = [];
        
        this.phase = 0; // 0=Intro, 1=Human, 2=AI
        this.isPlaying = false;
        this.startTime = 0;
        this.elapsedTime = 0;
        this.fireSpreadRateMs = 1500;
        this.lastFireTime = 0;
        
        // AI Variables
        this.aiPath = [];
        this.aiPathIndex = 0;
        this.lastAiMoveTime = 0;
        
        this.metrics = {
            nodesExplored: 0,
            nodesExploredBFS: 0,
            pathCost: 0,
            computeTime: 0
        };
        
        // Mesh Groups
        this.wallsGroup = new THREE.Group();
        this.floorGroup = new THREE.Group();
        this.fireGroup = new THREE.Group();
        this.exitsGroup = new THREE.Group();
        
        this.scene.add(this.wallsGroup);
        this.scene.add(this.floorGroup);
        this.scene.add(this.fireGroup);
        this.scene.add(this.exitsGroup);
        
        // Entities
        this.playerMesh = null;
        this.playerLight = null;
        
        // Material Cache
        this.materials = {
            wall: new THREE.MeshStandardMaterial({ 
                color: 0x3d4a5d, 
                roughness: 0.8,
                metalness: 0.1
            }),
            floor: new THREE.MeshStandardMaterial({
                color: 0x141b26,
                roughness: 0.9,
                metalness: 0.0
            }),
            floorExplored: new THREE.MeshStandardMaterial({
                color: 0x00E5FF,
                roughness: 0.7,
                emissive: 0x00E5FF,
                emissiveIntensity: 0.1,
                transparent: true,
                opacity: 0.5
            }),
            fire: new THREE.MeshStandardMaterial({
                color: 0xFF5722,
                emissive: 0xFF5722,
                emissiveIntensity: 1.5,
                roughness: 0.4
            }),
            fireCore: new THREE.MeshStandardMaterial({
                color: 0xffdbd1,
                emissive: 0xffdbd1,
                emissiveIntensity: 2.0,
                roughness: 0.2
            }),
            exit: new THREE.MeshStandardMaterial({
                color: 0xb6ffae,
                emissive: 0xb6ffae,
                emissiveIntensity: 1.2
            }),
            playerHuman: new THREE.MeshStandardMaterial({
                color: 0x00E5FF,
                emissive: 0x00E5FF,
                emissiveIntensity: 0.8
            }),
            playerAI: new THREE.MeshStandardMaterial({
                color: 0x00E5FF,
                emissive: 0x00E5FF,
                emissiveIntensity: 1.2
            })
        };
        
        this.setupLighting();
        this.bindInput();
        
        // Start Render Loop
        this.animate();
    }

    setupLighting() {
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
        
        // Global moon/dim directional light
        const dirLight = new THREE.DirectionalLight(0xaaccff, 0.3);
        dirLight.position.set(50, 60, 20);
        dirLight.castShadow = true;
        dirLight.shadow.mapSize.width = 2048;
        dirLight.shadow.mapSize.height = 2048;
        dirLight.shadow.camera.left = -40;
        dirLight.shadow.camera.right = 40;
        dirLight.shadow.camera.top = 40;
        dirLight.shadow.camera.bottom = -40;
        this.scene.add(dirLight);
        
        // Player Spotlight (attached to player later)
        this.playerLight = new THREE.PointLight(0x00E5FF, 1.5, 20);
        // Cast shadow disabled for significant performance gain
        this.playerLight.castShadow = false; 
        this.scene.add(this.playerLight);
    }
    
    getCoord(x) {
        // Center the grid: 0 to gridSize -> -gridSize/2 to +gridSize/2
        return (x - this.gridSize/2) * this.cellSize;
    }

    playIntro() {
        this.phase = 0;
        this.isPlaying = false;
        
        // Reset Camera for cinematic sweep
        // Start high up and zoomed out
        this.camera.position.set(0, 100, 0);
        this.camera.lookAt(0, 0, 0);
        
        // Show cinematic overlay
        const overlay = document.getElementById('intro-overlay');
        overlay.style.display = 'flex'; // Reset display
        overlay.style.pointerEvents = 'auto';
        overlay.style.opacity = '1';
        
        document.querySelector('.cinematic-title').style.opacity = '0';
        document.querySelector('#intro-overlay p').style.opacity = '0';
        
        // Tween HTML overlay
        gsap.to('.cinematic-title', { opacity: 1, scale: 1, duration: 1.5, delay: 0.5, ease: 'power3.out' });
        gsap.to('#intro-overlay p', { opacity: 1, duration: 1, delay: 1.5 });
        
        // Animate out overlay
        gsap.to('#intro-overlay', { opacity: 0, duration: 1.5, delay: 3.5, onComplete: () => {
            overlay.style.pointerEvents = 'none';
            overlay.style.display = 'none'; // CRITICAL: Actually remove it from blocking
            
            // Show sidebar controls only AFTER the cinematic intro
            document.querySelector('.sidebar').style.display = 'flex';
        }});
        
        // Camera cinematic sweep (GSAP)
        const targetX = this.getCoord(this.player.x);
        const targetZ = this.getCoord(this.player.y);
        
        gsap.to(this.camera.position, {
            x: targetX,
            y: 35,
            z: targetZ + 30, // Angle down
            duration: 4,
            delay: 3,
            ease: 'power2.inOut',
            onUpdate: () => {
                this.controls.target.set(targetX, 0, targetZ);
            },
            onComplete: () => {
                // Done intro! Show human UI
                document.getElementById('val-mode').innerText = 'Ready to Start Phase 1';
            }
        });
    }

    build3DMap(mapData) {
        this.mapData = mapData; // Save for fire respawner
        this.map = mapData.grid;
        this.gridSize = mapData.cols;
        this.player = { ...mapData.playerSpawn };
        this.exits = [...mapData.exits];
        this.fireSet.clear();
        
        // Clear old meshes
        this.wallsGroup.clear();
        this.floorGroup.clear();
        this.fireGroup.clear();
        this.exitsGroup.clear();
        if(this.playerMesh) {
            this.scene.remove(this.playerMesh);
            this.playerMesh = null;
        }

        const wallHeight = 4;
        const cs = this.cellSize;
        
        // Base geometries to save memory
        const wallGeo = new THREE.BoxGeometry(cs, wallHeight, cs);
        const floorGeo = new THREE.PlaneGeometry(cs, cs);
        
        // Build Grid
        for(let y=0; y<this.gridSize; y++){
            for(let x=0; x<this.gridSize; x++){
                const cell = this.map[y][x];
                const px = this.getCoord(x);
                const pz = this.getCoord(y);
                
                if (cell === 1) { // Wall
                    const wall = new THREE.Mesh(wallGeo, this.materials.wall);
                    wall.position.set(px, wallHeight/2, pz);
                    wall.castShadow = true;
                    wall.receiveShadow = true;
                    this.wallsGroup.add(wall);
                } else { // Floor or Exit
                    const floor = new THREE.Mesh(floorGeo, this.materials.floor);
                    floor.rotation.x = -Math.PI / 2;
                    floor.position.set(px, 0, pz);
                    floor.receiveShadow = true;
                    // Tag it so AI can color explored
                    floor.userData = { x, y }; 
                    this.floorGroup.add(floor);
                }
            }
        }
        
        // Exits
        const exitGeo = new THREE.BoxGeometry(cs*0.8, 0.5, cs*0.8);
        for (const ex of this.exits) {
            const mesh = new THREE.Mesh(exitGeo, this.materials.exit);
            mesh.position.set(this.getCoord(ex.x), 0.25, this.getCoord(ex.y));
            this.exitsGroup.add(mesh);
            
            // Add green light
            const l = new THREE.PointLight(0xb6ffae, 1.5, 15);
            l.position.set(this.getCoord(ex.x), 2, this.getCoord(ex.y));
            this.exitsGroup.add(l);
        }
        
        // Player (Stylized Humanoid)
        this.playerMesh = new THREE.Group();
        const mat = this.materials.playerHuman;
        
        const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
        const head = new THREE.Mesh(headGeo, mat);
        head.position.y = 1.0;
        
        const torsoGeo = new THREE.BoxGeometry(0.7, 0.8, 0.4);
        const torso = new THREE.Mesh(torsoGeo, mat);
        torso.position.y = 0.4;
        
        const armGeo = new THREE.BoxGeometry(0.25, 0.7, 0.25);
        armGeo.translate(0, -0.25, 0);
        this.armL = new THREE.Mesh(armGeo, mat);
        this.armL.position.set(-0.5, 0.7, 0);
        
        this.armR = new THREE.Mesh(armGeo, mat);
        this.armR.position.set(0.5, 0.7, 0);
        
        const legGeo = new THREE.BoxGeometry(0.3, 0.7, 0.3);
        legGeo.translate(0, -0.35, 0);
        this.legL = new THREE.Mesh(legGeo, mat);
        this.legL.position.set(-0.2, 0.0, 0);
        
        this.legR = new THREE.Mesh(legGeo, mat);
        this.legR.position.set(0.2, 0.0, 0);
        
        this.playerMesh.add(head, torso, this.armL, this.armR, this.legL, this.legR);
        this.playerMesh.position.set(this.getCoord(this.player.x), 0.7, this.getCoord(this.player.y));
        this.scene.add(this.playerMesh);
        
        // Initial Fires
        for (let i = 0; i < 4; i++) {
            this.spawnRandomFire();
        }
    }

    reset(keepMap = false) {
        if (!keepMap) {
            const mg = new MapGenerator(this.gridSize, this.gridSize);
            const data = mg.generate();
            this.build3DMap(data);
            this.playIntro(); // Also triggers camera flyover
        } else {
            // Reset player and fire to initial state of the current map
            this.playerMesh.position.set(this.getCoord(this.player.x), 0.7, this.getCoord(this.player.y));
            this.syncFireMeshes();
            
            // Clear explored floors
            this.floorGroup.children.forEach(c => {
                c.material = this.materials.floor;
            });
        }
        
        this.isPlaying = false;
        this.elapsedTime = 0;
        this.aiPath = [];
        this.aiPathIndex = 0;
        this.lastAiMoveTime = performance.now();
        this.lastFireTime = performance.now();
        this.startTime = performance.now();
        
        this.updatePlayerLight();
    }

    startHumanPhase() {
        this.phase = 1;
        this.isPlaying = true;
        this.startTime = performance.now();
        this.lastFireTime = performance.now();
        this.playerMesh.children.forEach(c => c.material = this.materials.playerHuman);
        this.playerLight.color.setHex(0x00E5FF);
    }

    startAiPhase(gridCopy, fireSetCopy, playerStart) {
        this.phase = 2;
        this.map = gridCopy;
        this.fireSet = new Set(fireSetCopy);
        this.player = { ...playerStart };
        
        this.reset(true); // Reset visually to current map
        
        this.playerMesh.children.forEach(c => c.material = this.materials.playerAI);
        this.playerLight.color.setHex(0x00E5FF);
        
        this.isPlaying = true;
        this.startTime = performance.now();
        this.lastFireTime = performance.now();
        this.lastAiMoveTime = performance.now();
        
        this.computeAiPath();
    }

    computeAiPath() {
        // Run algorithms
        const t0 = performance.now();
        const aResult = AI.aStar(this.map, this.player, this.exits, this.fireSet);
        const t1 = performance.now();
        
        const bfsRes = AI.bfs(this.map, this.player, this.exits, this.fireSet);
        
        this.aiPath = aResult.path || [];
        this.aiPathIndex = 0;
        
        this.metrics.nodesExplored = aResult.nodesExplored || 0;
        this.metrics.nodesExploredBFS = bfsRes.nodesExplored || 0;
        this.metrics.pathCost = this.aiPath.length;
        this.metrics.computeTime = (t1 - t0).toFixed(2);
        
        // Color explored nodes visually in 3D
        if (aResult.explored) {
            this.floorGroup.children.forEach(mesh => {
                const ud = mesh.userData;
                if (aResult.explored.has(`${ud.x},${ud.y}`)) {
                    mesh.material = this.materials.floorExplored;
                }
            });
        }
        
        this.updateUI();
    }

    spawnRandomFire() {
        if (!this.mapData || !this.mapData.rooms || this.mapData.rooms.length === 0) return;
        
        // Pick a room far from player
        const possibleRooms = this.mapData.rooms.filter(r => 
            Math.abs((r.x + Math.floor(r.w/2)) - this.player.x) > 5 ||
            Math.abs((r.y + Math.floor(r.h/2)) - this.player.y) > 5
        );
        
        const targetRoom = possibleRooms.length > 0 ? possibleRooms[Math.floor(Math.random() * possibleRooms.length)] : this.mapData.rooms[0];
        
        // Seed 2-3 fire blocks in the same room to create a cluster origin
        for(let i=0; i<3; i++) {
            const fx = targetRoom.x + Math.floor(Math.random() * targetRoom.w);
            const fy = targetRoom.y + Math.floor(Math.random() * targetRoom.h);
            if (this.map[fy][fx] === 0) {
                this.fireSet.add(`${fx},${fy}`);
            }
        }
        
        this.syncFireMeshes();
    }

    syncFireMeshes() {
        this.fireGroup.clear();
        
        // Use Tetrahedrons to look more like chaotic flames
        const flameOuterGeo = new THREE.TetrahedronGeometry(this.cellSize * 0.45);
        const flameInnerGeo = new THREE.TetrahedronGeometry(this.cellSize * 0.25);
        
        for (const loc of this.fireSet) {
            const [fx, fy] = loc.split(',').map(Number);
            
            // Create a small cluster of meshes per fire cell
            const cluster = new THREE.Group();
            cluster.position.set(this.getCoord(fx), this.cellSize * 0.2, this.getCoord(fy));
            
            // Outer Red Flame
            const outer1 = new THREE.Mesh(flameOuterGeo, this.materials.fire);
            outer1.position.y = 0.2;
            outer1.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);
            
            const outer2 = new THREE.Mesh(flameOuterGeo, this.materials.fire);
            outer2.position.set(0.2, 0.1, -0.2);
            outer2.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, 0);

            // Inner Yellow Core
            const core = new THREE.Mesh(flameInnerGeo, this.materials.fireCore);
            core.position.y = 0.4;
            core.rotation.set(Math.random()*Math.PI, 0, Math.random()*Math.PI);

            cluster.add(outer1);
            cluster.add(outer2);
            cluster.add(core);
            
            // Store random offsets for the animate loop to make them flicker and spin chaotically
            cluster.userData = { 
                offset: Math.random() * Math.PI * 2,
                speed: 0.05 + Math.random() * 0.05
            };
            
            this.fireGroup.add(cluster);
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
                    if (this.map[ny][nx] === 0 && Math.random() < 0.25) {
                        newFire.add(`${nx},${ny}`);
                    }
                }
            }
        }
        this.fireSet = newFire;
        this.syncFireMeshes();
        
        // AI Phase: Reroute if blocked!
        if (this.phase === 2 && this.isPlaying && this.aiPath.length > 0) {
            let blocked = false;
            for (let i = this.aiPathIndex; i < this.aiPath.length; i++) {
                const n = this.aiPath[i];
                if (this.fireSet.has(`${n.x},${n.y}`)) {
                    blocked = true;
                    break;
                }
            }
            if (blocked) {
                this.computeAiPath();
                if (this.aiPath.length === 0) {
                     this.endGame('Loss');
                }
            }
        }
    }

    bindInput() {
        window.addEventListener('keydown', (e) => {
            // Prevent default scrolling for arrows/space
            if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].indexOf(e.code) > -1) {
                e.preventDefault();
            }

            if (this.phase !== 1 || !this.isPlaying) return;
            
            let mapDx = 0, mapDy = 0;
            if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') mapDy = -1;
            else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') mapDy = 1;
            else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') mapDx = -1;
            else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') mapDx = 1;
            
            if (mapDx === 0 && mapDy === 0) return;
            
            let dx = mapDx;
            let dy = mapDy;
            
            if (this.isPlayerMoving) {
                this.nextMoveCommand = { dx, dy };
                return;
            }
            
            this.movePlayer(dx, dy);
        }, { passive: false });
    }

    movePlayer(dx, dy) {
        const nx = this.player.x + dx;
        const ny = this.player.y + dy;
        
        if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
            if (this.map[ny][nx] !== 1) { // Not a wall
                this.player.x = nx;
                this.player.y = ny;
                
                this.isPlayerMoving = true; // Lock input
                
                // Tween model in 3D
                gsap.to(this.playerMesh.position, {
                    x: this.getCoord(nx),
                    z: this.getCoord(ny),
                    duration: 0.18, 
                    ease: "power1.out",
                    onComplete: () => {
                        this.isPlayerMoving = false; // Unlock input
                        this.checkWinLoss(); // Check win condition after moving
                        
                        if (this.nextMoveCommand) {
                            let cmd = this.nextMoveCommand;
                            this.nextMoveCommand = null;
                            this.movePlayer(cmd.dx, cmd.dy);
                        }
                    }
                });
                
                // The Hop!
                gsap.to(this.playerMesh.position, {
                    y: 1.5,
                    yoyo: true,
                    repeat: 1,
                    duration: 0.09,
                    ease: "sine.inOut"
                });
                
                // Rotate to face direction
                const angle = Math.atan2(dx, dy);
                gsap.to(this.playerMesh.rotation, {
                    y: angle,
                    duration: 0.15,
                    ease: "power2.out"
                });
                
                this.updatePlayerLight();
            }
        }
    }
    
    updatePlayerLight() {
        if (!this.playerLight || !this.playerMesh) return;
        this.playerLight.position.set(
            this.playerMesh.position.x,
            4,
            this.playerMesh.position.z
        );
        // Follow cam smoothly
        gsap.to(this.controls.target, {
            x: this.playerMesh.position.x,
            z: this.playerMesh.position.z,
            duration: 0.5
        });
    }

    checkWinLoss() {
        if (!this.isPlaying) return;
        if (this.fireSet.has(`${this.player.x},${this.player.y}`)) {
            this.endGame('Loss');
            return;
        }
        for (const ex of this.exits) {
            if (this.player.x === ex.x && this.player.y === ex.y) {
                this.endGame('Win');
                return;
            }
        }
    }
    
    endGame(result) {
        this.isPlaying = false;
        
        // Trigger Meme if human burns to death
        if (this.phase === 1 && result === 'Loss') {
            if (window.triggerAagMeme) window.triggerAagMeme();
        }
        
        if (this.onGameOver) this.onGameOver(result, this.elapsedTime);
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

    animate() {
        requestAnimationFrame(() => this.animate());
        
        const timestamp = performance.now();
        
        if (this.isPlaying) {
            this.elapsedTime = (timestamp - this.startTime) / 1000;
            
            // Fire Spread
            if (timestamp - this.lastFireTime > this.fireSpreadRateMs) {
                this.spreadFire();
                this.lastFireTime = timestamp;
                this.checkWinLoss();
            }
            
            // AI Movement
            if (this.phase === 2 && timestamp - this.lastAiMoveTime > 200) {
                if (this.aiPathIndex < this.aiPath.length) {
                    const nextNode = this.aiPath[this.aiPathIndex];
                    const dx = nextNode.x - this.player.x;
                    const dy = nextNode.y - this.player.y;
                    
                    this.player.x = nextNode.x;
                    this.player.y = nextNode.y;
                    
                    gsap.to(this.playerMesh.position, {
                        x: this.getCoord(nextNode.x),
                        z: this.getCoord(nextNode.y),
                        duration: 0.18, // Match human speed
                        ease: "power1.out"
                    });
                    
                    gsap.to(this.playerMesh.position, {
                        y: 1.5,
                        yoyo: true,
                        repeat: 1,
                        duration: 0.09,
                        ease: "sine.inOut"
                    });
                    
                    const angle = Math.atan2(dx, dy);
                    gsap.to(this.playerMesh.rotation, {
                        y: angle,
                        duration: 0.1
                    });
                    
                    this.updatePlayerLight();
                    this.aiPathIndex++;
                    this.lastAiMoveTime = timestamp;
                    this.checkWinLoss();
                } else if (this.aiPath.length === 0) {
                    this.endGame('Loss');
                }
            }
            
            this.updateUI();
        }
        
        // Animate Fire visually (spin and throb)
        const time = timestamp;
        this.fireGroup.children.forEach(cluster => {
            if (cluster.userData) {
                const scaleVal = 0.8 + Math.sin(time * 0.005 + cluster.userData.offset) * 0.3;
                cluster.scale.set(scaleVal, scaleVal, scaleVal);
                
                cluster.children[0].rotation.y += cluster.userData.speed;
                cluster.children[0].rotation.x += cluster.userData.speed * 0.5;
                
                cluster.children[1].rotation.y -= cluster.userData.speed * 0.8;
                cluster.children[1].rotation.z += cluster.userData.speed;
                
                cluster.children[2].rotation.y += 0.1; 
            }
        });
        
        // Animate Humanoid Limbs
        if (this.armL) {
            const logicalX = this.getCoord(this.player.x);
            const logicalZ = this.getCoord(this.player.y);
            const dist = Math.abs(this.playerMesh.position.x - logicalX) + Math.abs(this.playerMesh.position.z - logicalZ);
            
            if (dist > 0.1) {
                // Running cycle
                const speed = time * 0.03;
                this.armL.rotation.x = Math.sin(speed) * 1.5;
                this.armR.rotation.x = Math.sin(speed + Math.PI) * 1.5;
                this.legL.rotation.x = Math.sin(speed + Math.PI) * 1.2;
                this.legR.rotation.x = Math.sin(speed) * 1.2;
            } else {
                // Stand idle
                this.armL.rotation.x = 0;
                this.armR.rotation.x = 0;
                this.legL.rotation.x = 0;
                this.legR.rotation.x = 0;
            }
        }
        
        // Smooth Lazy Camera Chase
        if (this.playerMesh) {
            // The camera "look" target chases the player
            this.controls.target.lerp(new THREE.Vector3(this.playerMesh.position.x, 0, this.playerMesh.position.z), 0.1);
            
            // Allow OrbitControls to do its math, then we add a tiny float for dramatic flair
            this.camera.position.y += Math.sin(time*0.001)*0.01; 
        }
        
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }
}
