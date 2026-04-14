class Leaf {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.MIN_LEAF_SIZE = 8;
        this.leftChild = null;
        this.rightChild = null;
        this.room = null;
        this.halls = [];
    }

    split() {
        if (this.leftChild || this.rightChild) return false;
        
        let splitH = Math.random() > 0.5;
        if (this.width > this.height && this.width / this.height >= 1.25) splitH = false;
        else if (this.height > this.width && this.height / this.width >= 1.25) splitH = true;

        let max = (splitH ? this.height : this.width) - this.MIN_LEAF_SIZE;
        if (max <= this.MIN_LEAF_SIZE) return false;

        let split = Math.floor(Math.random() * (max - this.MIN_LEAF_SIZE)) + this.MIN_LEAF_SIZE;

        if (splitH) {
            this.leftChild = new Leaf(this.x, this.y, this.width, split);
            this.rightChild = new Leaf(this.x, this.y + split, this.width, this.height - split);
        } else {
            this.leftChild = new Leaf(this.x, this.y, split, this.height);
            this.rightChild = new Leaf(this.x + split, this.y, this.width - split, this.height);
        }
        return true;
    }

    createRooms() {
        if (this.leftChild || this.rightChild) {
            if (this.leftChild) this.leftChild.createRooms();
            if (this.rightChild) this.rightChild.createRooms();
            if (this.leftChild && this.rightChild) {
                this.createHall(this.leftChild.getRoom(), this.rightChild.getRoom());
            }
        } else {
            let roomSize = {
                w: Math.floor(Math.random() * (this.width - 4)) + 4,
                h: Math.floor(Math.random() * (this.height - 4)) + 4
            };
            let roomPos = {
                x: Math.floor(Math.random() * (this.width - roomSize.w - 1)) + 1,
                y: Math.floor(Math.random() * (this.height - roomSize.h - 1)) + 1
            };
            this.room = { x: this.x + roomPos.x, y: this.y + roomPos.y, w: roomSize.w, h: roomSize.h };
        }
    }

    getRoom() {
        if (this.room) return this.room;
        let lRoom, rRoom;
        if (this.leftChild) lRoom = this.leftChild.getRoom();
        if (this.rightChild) rRoom = this.rightChild.getRoom();
        if (!lRoom && !rRoom) return null;
        if (!rRoom) return lRoom;
        if (!lRoom) return rRoom;
        return Math.random() > 0.5 ? lRoom : rRoom;
    }

    createHall(l, r) {
        if (!l || !r) return;
        this.halls.push([
            { x: Math.floor(l.x + l.w / 2), y: Math.floor(l.y + l.h / 2) },
            { x: Math.floor(r.x + r.w / 2), y: Math.floor(r.y + r.h / 2) }
        ]);
    }

    getAllRooms(rooms = []) {
        if (this.room) rooms.push(this.room);
        if (this.leftChild) this.leftChild.getAllRooms(rooms);
        if (this.rightChild) this.rightChild.getAllRooms(rooms);
        return rooms;
    }

    getAllHalls(halls = []) {
        if (this.halls.length > 0) halls.push(...this.halls);
        if (this.leftChild) this.leftChild.getAllHalls(halls);
        if (this.rightChild) this.rightChild.getAllHalls(halls);
        return halls;
    }
}

class MapGenerator {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.grid = [];
        this.rooms = [];
        this.exits = [];
        this.playerSpawn = { x: 0, y: 0 };
    }

    static FLOOR = 0;
    static WALL = 1;
    static EXIT = 2;

    generate() {
        this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(MapGenerator.WALL));
        this.exits = [];

        // BSP Generation
        const root = new Leaf(1, 1, this.cols - 2, this.rows - 2);
        const leaves = [root];
        let didSplit = true;

        while (didSplit) {
            didSplit = false;
            for (let i = 0; i < leaves.length; i++) {
                let l = leaves[i];
                if (!l.leftChild && !l.rightChild) {
                    if (l.width > 12 || l.height > 12 || Math.random() > 0.25) {
                        if (l.split()) {
                            leaves.push(l.leftChild);
                            leaves.push(l.rightChild);
                            didSplit = true;
                        }
                    }
                }
            }
        }

        root.createRooms();
        this.rooms = root.getAllRooms();
        const halls = root.getAllHalls();

        // Carve rooms into grid
        for (const room of this.rooms) {
            for (let y = room.y; y < room.y + room.h; y++) {
                for (let x = room.x; x < room.x + room.w; x++) {
                    if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
                        this.grid[y][x] = MapGenerator.FLOOR;
                    }
                }
            }
        }

        // Carve halls
        for (const hall of halls) {
            this.createCorridor(hall[0], hall[1]);
        }
        
        // Add random loops (Alternative Paths to bypass fire)
        for (let i = 0; i < 6; i++) {
            const r1 = this.rooms[Math.floor(Math.random() * this.rooms.length)];
            const r2 = this.rooms[Math.floor(Math.random() * this.rooms.length)];
            if (r1 !== r2) {
                const c1 = {x: r1.x + Math.floor(r1.w/2), y: r1.y + Math.floor(r1.h/2)};
                const c2 = {x: r2.x + Math.floor(r2.w/2), y: r2.y + Math.floor(r2.h/2)};
                this.createCorridor(c1, c2);
            }
        }

        this.playerSpawn = { x: Math.floor(this.rooms[0].x + this.rooms[0].w/2), y: Math.floor(this.rooms[0].y + this.rooms[0].h/2) };
        this.placeExits();

        return {
            grid: this.grid,
            playerSpawn: this.playerSpawn,
            exits: this.exits,
            cols: this.cols,
            rows: this.rows,
            rooms: this.rooms // Pass rooms out for Fire Respawn mechanic!
        };
    }

    createCorridor(p1, p2) {
        let x1 = p1.x;
        let y1 = p1.y;
        let x2 = p2.x;
        let y2 = p2.y;
        
        // Build an L-shaped corridor
        let path = [];
        if (Math.random() < 0.5) {
            // Horizontal then vertical
            for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) path.push({x, y: y1});
            for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) path.push({x: x2, y});
        } else {
            // Vertical then horizontal
            for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) path.push({x: x1, y});
            for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++) path.push({x, y: y2});
        }

        for (const p of path) {
            if (p.y > 0 && p.y < this.rows - 1 && p.x > 0 && p.x < this.cols - 1) {
                this.grid[p.y][p.x] = MapGenerator.FLOOR;
                
                // Double width corridor for realism
                if (p.y + 1 < this.rows - 1) this.grid[p.y + 1][p.x] = MapGenerator.FLOOR;
                if (p.x + 1 < this.cols - 1) this.grid[p.y][p.x + 1] = MapGenerator.FLOOR;
            }
        }
    }

    placeExits() {
        let placed = 0;
        const outerRooms = [];
        
        // Find rooms that touch edges
        for (const r of this.rooms) {
            if (r.x <= 2 || r.y <= 2 || r.x + r.w >= this.cols - 3 || r.y + r.h >= this.rows - 3) {
                outerRooms.push(r);
            }
        }

        // Sort strictly by distance to guarantee furthest spawn
        outerRooms.sort((a,b) => {
             let distA = Math.abs(a.x - this.playerSpawn.x) + Math.abs(a.y - this.playerSpawn.y);
             let distB = Math.abs(b.x - this.playerSpawn.x) + Math.abs(b.y - this.playerSpawn.y);
             return distB - distA; // Descending
        });
        
        // Take the 1 absolute furthest room to be the exit
        let candidates = outerRooms.slice(0, 1);

        while (placed < candidates.length) {
            const r = candidates[placed];
            let ex = 0, ey = 0;
            
            // Pick a wall
            if (r.x <= 2) { ex = 0; ey = r.y + Math.floor(r.h/2); }
            else if (r.x + r.w >= this.cols - 3) { ex = this.cols - 1; ey = r.y + Math.floor(r.h/2); }
            else if (r.y <= 2) { ex = r.x + Math.floor(r.w/2); ey = 0; }
            else { ex = r.x + Math.floor(r.w/2); ey = this.rows - 1; }

            // Drill to border
            let cx = r.x + Math.floor(r.w/2);
            let cy = r.y + Math.floor(r.h/2);
            let dx = ex > cx ? 1 : (ex < cx ? -1 : 0);
            let dy = ey > cy ? 1 : (ey < cy ? -1 : 0);

            // Carve
            while(cx !== ex || cy !== ey) {
                if (cy > 0 && cy < this.rows - 1 && cx > 0 && cx < this.cols - 1) {
                    this.grid[cy][cx] = MapGenerator.FLOOR;
                }
                cx += dx; cy += dy;
            }
            
            this.grid[ey][ex] = MapGenerator.EXIT;
            this.exits.push({ x: ex, y: ey });
            placed++;
        }
    }
}
