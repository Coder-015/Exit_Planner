class MapGenerator {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.grid = [];
        this.rooms = [];
        this.exits = [];
        this.playerSpawn = { x: 0, y: 0 };
    }

    // Constants for cell types
    static FLOOR = 0;
    static WALL = 1;
    static EXIT = 2;

    generate() {
        // Initialize all walls
        this.grid = Array.from({ length: this.rows }, () => Array(this.cols).fill(MapGenerator.WALL));
        this.rooms = [];
        this.exits = [];

        // Generate rooms
        const numRooms = 12;
        const minRoomSize = 4;
        const maxRoomSize = 8;

        for (let i = 0; i < numRooms; i++) {
            const w = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
            const h = Math.floor(Math.random() * (maxRoomSize - minRoomSize + 1)) + minRoomSize;
            const x = Math.floor(Math.random() * (this.cols - w - 2)) + 1;
            const y = Math.floor(Math.random() * (this.rows - h - 2)) + 1;

            const newRoom = { x, y, w, h, center: { x: Math.floor(x + w / 2), y: Math.floor(y + h / 2) } };

            let failed = false;
            for (const otherRoom of this.rooms) {
                if (this.intersects(newRoom, otherRoom)) {
                    failed = true;
                    break;
                }
            }

            if (!failed) {
                this.createRoom(newRoom);
                if (this.rooms.length > 0) {
                    const prevRoom = this.rooms[this.rooms.length - 1];
                    this.createCorridor(prevRoom.center, newRoom.center);
                }
                this.rooms.push(newRoom);
            }
        }

        // Add 2 random exits at the edges
        this.placeExits();

        // Spawn player in the first room
        this.playerSpawn = { ...this.rooms[0].center };

        return {
            grid: this.grid,
            playerSpawn: this.playerSpawn,
            exits: this.exits,
            cols: this.cols,
            rows: this.rows
        };
    }

    intersects(r1, r2) {
        return (r1.x <= r2.x + r2.w + 1 && r1.x + r1.w + 1 >= r2.x &&
                r1.y <= r2.y + r2.h + 1 && r1.y + r1.h + 1 >= r2.y);
    }

    createRoom(room) {
        for (let y = room.y; y < room.y + room.h; y++) {
            for (let x = room.x; x < room.x + room.w; x++) {
                if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
                    this.grid[y][x] = MapGenerator.FLOOR;
                }
            }
        }
    }

    createCorridor(p1, p2) {
        let x = p1.x;
        let y = p1.y;

        while (x !== p2.x || y !== p2.y) {
            if (Math.random() > 0.5) {
                if (x !== p2.x) x += (p2.x > x ? 1 : -1);
                else y += (p2.y > y ? 1 : -1);
            } else {
                if (y !== p2.y) y += (p2.y > y ? 1 : -1);
                else x += (p2.x > x ? 1 : -1);
            }

            if (y > 0 && y < this.rows - 1 && x > 0 && x < this.cols - 1) {
                this.grid[y][x] = MapGenerator.FLOOR;
                
                // Make corridors slightly wider sometimes 
                if (Math.random() > 0.7) {
                    if (y + 1 < this.rows - 1) this.grid[y + 1][x] = MapGenerator.FLOOR;
                    if (x + 1 < this.cols - 1) this.grid[y][x + 1] = MapGenerator.FLOOR;
                }
            }
        }
    }

    placeExits() {
        let placed = 0;
        let attempts = 0;
        while (placed < 2 && attempts < 100) {
            // Find a random edge
            const edge = Math.floor(Math.random() * 4);
            let ex = 0;
            let ey = 0;
            let dx = 0;
            let dy = 0;

            if (edge === 0) { // Top
                ex = Math.floor(Math.random() * (this.cols - 4)) + 2; ey = 0; dy = 1;
            } else if (edge === 1) { // Bottom
                ex = Math.floor(Math.random() * (this.cols - 4)) + 2; ey = this.rows - 1; dy = -1;
            } else if (edge === 2) { // Left
                ex = 0; ey = Math.floor(Math.random() * (this.rows - 4)) + 2; dx = 1;
            } else if (edge === 3) { // Right
                ex = this.cols - 1; ey = Math.floor(Math.random() * (this.rows - 4)) + 2; dx = -1;
            }

            // Drill inwards until we hit a floor
            let cx = ex;
            let cy = ey;
            let drilled = 0;
            let hitFloor = false;

            while (drilled < (this.cols / 2)) {
                if (this.grid[cy] && this.grid[cy][cx] === MapGenerator.FLOOR) {
                    hitFloor = true;
                    break;
                }
                cx += dx;
                cy += dy;
                drilled++;
            }

            if (hitFloor && drilled > 0 && drilled < 10) {
                // Dig path to exit
                let px = ex;
                let py = ey;
                while (px !== cx || py !== cy) {
                    this.grid[py][px] = MapGenerator.FLOOR;
                    px += dx;
                    py += dy;
                }
                // Place exit at edge
                this.grid[ey][ex] = MapGenerator.EXIT;
                this.exits.push({ x: ex, y: ey });
                placed++;
            }
            attempts++;
        }
    }
}
