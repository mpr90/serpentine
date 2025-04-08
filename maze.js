const MAZE_CONFIG = {

    backgroundColor: '#000000',
    wallThickness: 10,
    doorThickness: 6,
    segmentSize: 25, // Base size for serpent segments
    gridSize: 50, // Size of each grid square in pixels
    gridWidth: 13, // Number of grid squares horizontally 
    gridHeight: 11, // Number of grid squares vertically 
    offsetX: 50, // Left margin
    offsetY: 50,  // Top margin
    debug: true, // Enable to show grid lines
    debugLogging: false // Enable to show debug logging
};

const COLORS = {
    WALL: '#5581B8',
    BACKGROUND: '#000000',
    GRID_LINE: '#333333',
    TEXT: '#FFFFFF',
    PLAYER: '#5581B8',
    ENEMY: '#CA818B',
    ENEMY_VULNERABLE: '#5AAE56',
    LIVES: '#5581B8',
    GAME_OVER: '#FF0000'
};

const CONTROLS = {
    UP: ['ArrowUp', 'w', 'W'],
    DOWN: ['ArrowDown', 's', 'S'],
    LEFT: ['ArrowLeft', 'a', 'A'],
    RIGHT: ['ArrowRight', 'd', 'D']
};

// Wall types - using powers of 2 for bitwise operations
const WALL_TYPES = {
    NONE:   0,
    TOP:    1,   // 2^0
    RIGHT:  2,   // 2^1
    BOTTOM: 4,   // 2^2
    LEFT:   8,   // 2^3
    DOOR:   16   // 2^4
};

// Level definitions using wall type constants
const T = WALL_TYPES.TOP;
const L = WALL_TYPES.LEFT;
const R = WALL_TYPES.RIGHT;
const B = WALL_TYPES.BOTTOM;
const D = WALL_TYPES.DOOR;
const LEVEL_WALLS = {
    1: [
        [0    , 0   , B   , B   , B   , 0   , B   , 0   , B   , 0   , B   , B   , 0   ],
        [R    , B   , R   , 0   , R   , R   , 0   , B   , R   , 0   , B   , R   , 0   ],
        [R    , 0   , B|R , R   , B   , R   , B   , R   , R   , B   , R   , R   , 0   ],
        [0    , R   , 0   , 0   , R   , 0   , B   , B|R , 0   , B   , B   , B   , 0   ],
        [R    , R   , R   , R   , R   , 0   , 0   , 0   , B   , B   , B   , R   , 0   ],
        [R    , 0   , R   , R   , 0   , R   , R   , 0   , B   , B   , B   , 0   , 0   ],
        [R    , R   , R   , R   , R   , 0   , B   , B   , 0   , B   , B   , B|R , 0   ],
        [B|D  , R   , B   , 0   , B|R , 0   , B   , R   , 0   , B   , R   , 0   , B|D ],
        [R    , B   , R   , R   , 0   , R   , 0   , B|R , R   , 0   , B|R , R   , 0   ],
        [R    , 0   , B|R , B   , B|R , R   , B   , 0   , B|R , 0   , B   , B|R , 0   ],
        [R    , 0   , 0   , 0   , 0   , 0   , 0   , 0   , 0   , R   , 0   , 0   , 0   ]
    ]
    // Add more levels here as needed
};
const LEVEL_PLAYER_START = {
    1: {x: 12, y: 8}
};
const LEVEL_ENEMY_START = {
    1: {x: 0, y: 8}
};
class Maze {
    constructor() {
        this.walls = [];
        this.initializeWalls();
        this.level = 1;
        
        // Door animation properties - now separate for enemy and player pens
        this.enemyDoorOpenProgress = 0; // 0 = closed, 1 = fully open
        this.playerDoorOpenProgress = 0; // 0 = closed, 1 = fully open
        this.doorAnimationSpeed = 0.02; // Speed of door animation
        this.enemyDoorAnimationDirection = 0; // 1 = opening, -1 = closing, 0 = no animation
        this.playerDoorAnimationDirection = 0; // 1 = opening, -1 = closing, 0 = no animation
        this.enemyDoorAnimationComplete = false;
        this.playerDoorAnimationComplete = false;
    }

    initializeWalls() {
        // Initialize walls array with empty cells
        for (let y = 0; y < MAZE_CONFIG.gridHeight; y++) {
            this.walls[y] = [];
            for (let x = 0; x < MAZE_CONFIG.gridWidth; x++) {
                this.walls[y][x] = WALL_TYPES.NONE;
            }
        }
    }

    /**
     * Sets up a new level in the maze by initializing walls and border walls.
     * This method clears any existing walls and sets up the maze structure for the specified level.
     * It first establishes border walls around the perimeter, then loads and applies the level-specific
     * wall configuration from LEVEL_WALLS. Finally, it validates the wall structure to ensure consistency
     * between adjacent cells.
     * 
     * @param {number} level - The level number to set up. Must correspond to a configuration in LEVEL_WALLS.
     * @returns {void}
     */
    setupLevel(level) {
        this.level = level;
        
        // Clear existing walls
        this.initializeWalls();
        
        // Always set border walls
        for (let i = 0; i < MAZE_CONFIG.gridWidth; i++) {
            this.walls[0][i] = WALL_TYPES.TOP;
            this.walls[MAZE_CONFIG.gridHeight - 1][i] = WALL_TYPES.BOTTOM;
        }
        for (let i = 0; i < MAZE_CONFIG.gridHeight; i++) {
            this.walls[i][0] = WALL_TYPES.LEFT;
            this.walls[i][MAZE_CONFIG.gridWidth - 1] = WALL_TYPES.RIGHT;
        }
        
        this.walls[0][0] = WALL_TYPES.TOP | WALL_TYPES.LEFT;  // Top-left corner
        this.walls[0][MAZE_CONFIG.gridWidth - 1] = WALL_TYPES.TOP | WALL_TYPES.RIGHT;  // Top-right corner
        this.walls[MAZE_CONFIG.gridHeight - 1][0] = WALL_TYPES.BOTTOM | WALL_TYPES.LEFT;  // Bottom-left corner
        this.walls[MAZE_CONFIG.gridHeight - 1][MAZE_CONFIG.gridWidth - 1] = WALL_TYPES.BOTTOM | WALL_TYPES.RIGHT;  // Bottom-right corner

        // Get the wall definitions for this level
        const levelWalls = LEVEL_WALLS[level];
        if (!levelWalls) {
            console.error(`No wall definitions found for level ${level}`);
            return;
        }
        
        // Copy the wall definitions to the maze
        for (let y = 0; y < MAZE_CONFIG.gridHeight; y++) {
            for (let x = 0; x < MAZE_CONFIG.gridWidth; x++) {
                this.walls[y][x] |= levelWalls[y][x];
            }
        }
        this.validateWalls();
    }

    /**
     * Validates and synchronizes wall definitions across adjacent cells.
     * When a wall is present on one side of a cell, ensures the corresponding
     * wall exists on the adjacent cell. For example, if cell A has a right wall,
     * ensures cell B (to the right) has a left wall. This maintains consistency
     * of the maze structure.
     */
    validateWalls() {
        // Iterate through all grid positions
        for (let y = 0; y < MAZE_CONFIG.gridHeight; y++) {
            for (let x = 0; x < MAZE_CONFIG.gridWidth; x++) {
                const wallType = this.walls[y][x];
                
                // Check right wall
                if ((x < MAZE_CONFIG.gridWidth - 1) && (wallType & WALL_TYPES.RIGHT)) {
                    // Add left wall to adjacent cell       
                    this.walls[y][x + 1] |= WALL_TYPES.LEFT;
                }
                
                // Check left wall
                if ((x > 0) && (wallType & WALL_TYPES.LEFT)) {
                    // Add right wall to adjacent cell       
                    this.walls[y][x - 1] |= WALL_TYPES.RIGHT;
                }
                
                // Check bottom wall
                if ((y < MAZE_CONFIG.gridHeight - 1) && (wallType & WALL_TYPES.BOTTOM)) {
                    // Add top wall to adjacent cell       
                    this.walls[y + 1][x] |= WALL_TYPES.TOP;
                    if (wallType & WALL_TYPES.DOOR) {
                        this.walls[y + 1][x] |= WALL_TYPES.DOOR;
                    }
                }
                
                // Check top wall
                if ((y > 0) && (wallType & WALL_TYPES.TOP)) {
                    // Add bottom wall to adjacent cell       
                    this.walls[y - 1][x] |= WALL_TYPES.BOTTOM;
                    if (wallType & WALL_TYPES.DOOR) {
                        this.walls[y - 1][x] |= WALL_TYPES.DOOR;
                    }
                }
            }
        }
    }

    update() {
        // Update enemy door animation if in progress
        if (this.enemyDoorAnimationDirection !== 0) {
            // Update door animation progress
            this.enemyDoorOpenProgress += this.doorAnimationSpeed * this.enemyDoorAnimationDirection;
            
            // Clamp progress between 0 and 1
            this.enemyDoorOpenProgress = Math.max(0, Math.min(1, this.enemyDoorOpenProgress));
            
            // Check if animation is complete
            if (this.enemyDoorOpenProgress >= 1 && this.enemyDoorAnimationDirection === 1) {
                this.enemyDoorAnimationComplete = true;
                // Once the door is fully open, remove the top wall to allow the enemy to enter the maze but not return to the pen
                this.walls[LEVEL_ENEMY_START[this.level].y][LEVEL_ENEMY_START[this.level].x] &= ~WALL_TYPES.TOP;
            } else if (this.enemyDoorOpenProgress <= 0 && this.enemyDoorAnimationDirection === -1) {
                this.enemyDoorAnimationComplete = true;
                // Once the door is fully closed, add back the wall segments that were removed
                this.walls[LEVEL_ENEMY_START[this.level].y][LEVEL_ENEMY_START[this.level].x] |= WALL_TYPES.TOP;
            }
        }
        
        // Update player door animation if in progress
        if (this.playerDoorAnimationDirection !== 0) {
            // Update door animation progress
            this.playerDoorOpenProgress += this.doorAnimationSpeed * this.playerDoorAnimationDirection;
            
            // Clamp progress between 0 and 1
            this.playerDoorOpenProgress = Math.max(0, Math.min(1, this.playerDoorOpenProgress));
            
            // Check if animation is complete
            if (this.playerDoorOpenProgress >= 1 && this.playerDoorAnimationDirection === 1) {
                this.playerDoorAnimationComplete = true;
                // Once the door is fully open, remove the top wall to allow the player to enter the maze but not return to the pen
                this.walls[LEVEL_PLAYER_START[this.level].y][LEVEL_PLAYER_START[this.level].x] &= ~WALL_TYPES.TOP;
            } else if (this.playerDoorOpenProgress <= 0 && this.playerDoorAnimationDirection === -1) {
                this.playerDoorAnimationComplete = true;
                // Once the door is fully closed, add back the wall segments that were removed
                this.walls[LEVEL_PLAYER_START[this.level].y][LEVEL_PLAYER_START[this.level].x] |= WALL_TYPES.TOP;
            }
        }
    }
    
    /**
     * Starts the enemy door animation in the specified direction.
     * @param {number} direction - The direction of the animation:
     *                            1 for opening animation
     *                            -1 for closing animation
     *                            0 for no animation
     */
    startEnemyDoorAnimation(direction) {
        this.enemyDoorAnimationDirection = direction;
        this.enemyDoorAnimationComplete = false;
    }
    
    /**
     * Starts the player door animation in the specified direction.
     * @param {number} direction - The direction of the animation:
     *                            1 for opening animation
     *                            -1 for closing animation
     *                            0 for no animation
     */
    startPlayerDoorAnimation(direction) {
        this.playerDoorAnimationDirection = direction;
        this.playerDoorAnimationComplete = false;
    }
    
    /**
     * Checks if the enemy door animation is complete.
     * @returns {boolean} True if the animation is complete, false otherwise.
     */
    isEnemyDoorAnimationComplete() {
        return this.enemyDoorAnimationComplete;
    }
    
    /**
     * Checks if the player door animation is complete.
     * @returns {boolean} True if the animation is complete, false otherwise.
     */
    isPlayerDoorAnimationComplete() {
        return this.playerDoorAnimationComplete;
    }
    
    /**
     * Gets the current progress of the enemy door animation.
     * @returns {number} The current progress of the animation (0 to 1).
     */
    getEnemyDoorProgress() {
        return this.enemyDoorOpenProgress;
    }
    
    /**
     * Gets the current progress of the player door animation.
     * @returns {number} The current progress of the animation (0 to 1).
     */
    getPlayerDoorProgress() {
        return this.playerDoorOpenProgress;
    }

    draw(ctx) {
        // Draw debug grid if enabled
        if (MAZE_CONFIG.debug) {
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 1;
            
            // Draw vertical grid lines
            for (let x = 0; x <= MAZE_CONFIG.gridWidth; x++) {
                const screenX = MAZE_CONFIG.offsetX + x * MAZE_CONFIG.gridSize;
                ctx.beginPath();
                ctx.moveTo(screenX, MAZE_CONFIG.offsetY);
                ctx.lineTo(screenX, MAZE_CONFIG.offsetY + MAZE_CONFIG.gridHeight * MAZE_CONFIG.gridSize);
                ctx.stroke();
            }
            
            // Draw horizontal grid lines
            for (let y = 0; y <= MAZE_CONFIG.gridHeight; y++) {
                const screenY = MAZE_CONFIG.offsetY + y * MAZE_CONFIG.gridSize;
                ctx.beginPath();
                ctx.moveTo(MAZE_CONFIG.offsetX, screenY);
                ctx.lineTo(MAZE_CONFIG.offsetX + MAZE_CONFIG.gridWidth * MAZE_CONFIG.gridSize, screenY);
                ctx.stroke();
            }

            // Draw wall type values in grid squares
            ctx.fillStyle = '#555555';  // Lighter color than debug grid
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            for (let y = 0; y < MAZE_CONFIG.gridHeight; y++) {
                for (let x = 0; x < MAZE_CONFIG.gridWidth; x++) {
                    const wallType = this.walls[y][x];
                    const screenX = MAZE_CONFIG.offsetX + (x * MAZE_CONFIG.gridSize) + (MAZE_CONFIG.gridSize / 2);
                    const screenY = MAZE_CONFIG.offsetY + (y * MAZE_CONFIG.gridSize) + (MAZE_CONFIG.gridSize / 2);
                    ctx.fillText(wallType.toString(16).toUpperCase(), screenX, screenY);
                }
            }
        }

        // Draw walls
        ctx.strokeStyle = COLORS.WALL;
        ctx.lineWidth = MAZE_CONFIG.wallThickness;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let y = 0; y < MAZE_CONFIG.gridHeight; y++) {
            for (let x = 0; x < MAZE_CONFIG.gridWidth; x++) {
                const wallType = this.walls[y][x];
                if (wallType === WALL_TYPES.NONE) continue;

                const screenX = MAZE_CONFIG.offsetX + x * MAZE_CONFIG.gridSize;
                const screenY = MAZE_CONFIG.offsetY + y * MAZE_CONFIG.gridSize;

                // Draw top wall
                if (wallType & WALL_TYPES.TOP && !(wallType & WALL_TYPES.DOOR)) {
                    this.drawTopWall(ctx, screenX, screenY);
                }
                // Draw right wall
                if (wallType & WALL_TYPES.RIGHT) {
                    this.drawRightWall(ctx, screenX, screenY);
                }
                // Draw bottom wall
                if (wallType & WALL_TYPES.BOTTOM && !(wallType & WALL_TYPES.DOOR)) {
                    this.drawBottomWall(ctx, screenX, screenY);
                }
                // Draw left wall
                if (wallType & WALL_TYPES.LEFT) {
                    this.drawLeftWall(ctx, screenX, screenY);
                }
            }
        }
        
        // Draw animated doors
        ctx.lineWidth = MAZE_CONFIG.doorThickness;
        this.drawDoors(ctx);
    }
    
    drawDoors(ctx) {
        // Draw enemy door
        let doorWidth = MAZE_CONFIG.gridSize * this.enemyDoorOpenProgress;
        
        let screenX = MAZE_CONFIG.offsetX + LEVEL_ENEMY_START[this.level].x * MAZE_CONFIG.gridSize;
        let screenY = MAZE_CONFIG.offsetY + LEVEL_ENEMY_START[this.level].y * MAZE_CONFIG.gridSize;
        
        // Draw left door
        ctx.beginPath();
        ctx.moveTo(screenX, screenY);
        ctx.lineTo(screenX + MAZE_CONFIG.gridSize - doorWidth, screenY);
        ctx.stroke();
        
        // Draw player door
        doorWidth = MAZE_CONFIG.gridSize * this.playerDoorOpenProgress;
        
        screenX = MAZE_CONFIG.offsetX + LEVEL_PLAYER_START[this.level].x * MAZE_CONFIG.gridSize;
        screenY = MAZE_CONFIG.offsetY + LEVEL_PLAYER_START[this.level].y * MAZE_CONFIG.gridSize;
        
        // Draw right door
        ctx.beginPath();
        ctx.moveTo(screenX + MAZE_CONFIG.gridSize - doorWidth, screenY);
        ctx.lineTo(screenX, screenY);
        ctx.stroke();
    }

    drawTopWall(ctx, x, y) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + MAZE_CONFIG.gridSize, y);
        ctx.stroke();
    }

    drawRightWall(ctx, x, y) {
        ctx.beginPath();
        ctx.moveTo(x + MAZE_CONFIG.gridSize, y);
        ctx.lineTo(x + MAZE_CONFIG.gridSize, y + MAZE_CONFIG.gridSize);
        ctx.stroke();
    }

    drawBottomWall(ctx, x, y) {
        ctx.beginPath();
        ctx.moveTo(x, y + MAZE_CONFIG.gridSize);
        ctx.lineTo(x + MAZE_CONFIG.gridSize, y + MAZE_CONFIG.gridSize);
        ctx.stroke();
    }

    drawLeftWall(ctx, x, y) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + MAZE_CONFIG.gridSize);
        ctx.stroke();
    }

    getWall(screenX, screenY) {
        // Convert screen coordinates to grid coordinates
        const gridX = Math.floor((screenX - MAZE_CONFIG.offsetX) / MAZE_CONFIG.gridSize);
        const gridY = Math.floor((screenY - MAZE_CONFIG.offsetY) / MAZE_CONFIG.gridSize);

        // Check if coordinates are within bounds
        if (gridX < 0 || gridX >= MAZE_CONFIG.gridWidth || 
            gridY < 0 || gridY >= MAZE_CONFIG.gridHeight) {
            return 0;
        } else {
            return this.walls[gridY][gridX];
        }
    }
} 