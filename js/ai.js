class PriorityQueue {
    constructor() {
        this.elements = [];
    }

    isEmpty() {
        return this.elements.length === 0;
    }

    put(item, priority) {
        this.elements.push({ item, priority });
        this.elements.sort((a, b) => a.priority - b.priority);
    }

    get() {
        return this.elements.shift().item;
    }
}

class AI {
    static manhattanDist(x1, y1, x2, y2) {
        return Math.abs(x1 - x2) + Math.abs(y1 - y2);
    }

    // Heuristic: Min Manhattan distance to ANY exit
    static heuristic(x, y, exits) {
        let minDist = Infinity;
        for (const ex of exits) {
            const d = AI.manhattanDist(x, y, ex.x, ex.y);
            if (d < minDist) minDist = d;
        }
        return minDist;
    }

    static aStar(map, start, exits, fireSet) {
        const rows = map.length;
        const cols = map[0].length;
        
        const frontier = new PriorityQueue();
        frontier.put({ x: start.x, y: start.y }, 0);
        
        const cameFrom = new Map();
        const costSoFar = new Map();
        
        const startKey = `${start.x},${start.y}`;
        cameFrom.set(startKey, null);
        costSoFar.set(startKey, 0);

        const explored = new Set();
        let goalNode = null;

        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]]; // Down, Right, Up, Left

        let nodesExplored = 0;

        while (!frontier.isEmpty()) {
            const current = frontier.get();
            const currentKey = `${current.x},${current.y}`;
            
            explored.add(currentKey);
            nodesExplored++;

            // Check if goal reached
            let foundExit = false;
            for (const ex of exits) {
                if (current.x === ex.x && current.y === ex.y) {
                    foundExit = true;
                    goalNode = current;
                    break;
                }
            }
            if (foundExit) break;

            for (const [dx, dy] of directions) {
                const next = { x: current.x + dx, y: current.y + dy };
                const nextKey = `${next.x},${next.y}`;

                // Boundary check
                if (next.x < 0 || next.x >= cols || next.y < 0 || next.y >= rows) continue;
                
                // Wall check
                if (map[next.y][next.x] === 1) continue;

                // Fire hazard check (treat as infinitely high cost or blocked)
                if (fireSet.has(nextKey)) continue;

                // Fire proximity check (slight penalty for walking near fire)
                let firePenalty = 0;
                const adjs = [[0,1],[1,0],[0,-1],[-1,0]];
                let nearFire = false;
                for (const [adx, ady] of adjs) {
                    if (fireSet.has(`${next.x+adx},${next.y+ady}`)) {
                        nearFire = true;
                        break;
                    }
                }
                if (nearFire) firePenalty = 5;

                const newCost = costSoFar.get(currentKey) + 1 + firePenalty;

                if (!costSoFar.has(nextKey) || newCost < costSoFar.get(nextKey)) {
                    costSoFar.set(nextKey, newCost);
                    // Add heuristic
                    const priority = newCost + AI.heuristic(next.x, next.y, exits);
                    frontier.put(next, priority);
                    cameFrom.set(nextKey, current);
                }
            }
        }

        if (!goalNode) {
            return {
                path: null,
                explored: explored,
                nodesExplored: nodesExplored
            };
        }

        // Reconstruct path
        const path = [];
        let curr = goalNode;
        while (curr !== null && !(curr.x === start.x && curr.y === start.y)) {
            path.push(curr);
            curr = cameFrom.get(`${curr.x},${curr.y}`);
        }
        path.reverse(); 

        return {
            path: path,
            explored: explored,
            nodesExplored: nodesExplored
        };
    }

    static bfs(map, start, exits, fireSet) {
        const rows = map.length;
        const cols = map[0].length;
        
        const queue = [{ x: start.x, y: start.y }];
        const explored = new Set();
        const startKey = `${start.x},${start.y}`;
        explored.add(startKey);
        
        let nodesExplored = 0;
        const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
        let foundExit = false;

        while (queue.length > 0) {
            const current = queue.shift();
            nodesExplored++;

            for (const ex of exits) {
                if (current.x === ex.x && current.y === ex.y) {
                    foundExit = true;
                    break;
                }
            }
            if (foundExit) break;

            for (const [dx, dy] of directions) {
                const next = { x: current.x + dx, y: current.y + dy };
                const nextKey = `${next.x},${next.y}`;

                if (next.x < 0 || next.x >= cols || next.y < 0 || next.y >= rows) continue;
                if (map[next.y][next.x] === 1) continue;
                if (fireSet.has(nextKey)) continue;

                if (!explored.has(nextKey)) {
                    explored.add(nextKey);
                    queue.push(next);
                }
            }
        }

        return { nodesExplored };
    }
}
