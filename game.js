class Game {
    // Game states
    static STATES = {
        INITIAL: 'initial',
        PREVIEW: 'preview',
        DOORS_OPENING: 'doorsOpening',
        RELEASING: 'releasing',
        DOORS_CLOSING: 'doorsClosing',
        PLAYING: 'playing',
        PLAYER_DEATH_WAIT: 'playerDeathWait',
        PLAYER_RESPAWN_WAIT: 'playerRespawnWait',
        PLAYER_RESPAWN: 'playerRespawn',
        GAME_OVER: 'gameOver'
    };

    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Set canvas dimensions
        this.canvas.width = 2 * MAZE_CONFIG.offsetX + MAZE_CONFIG.gridWidth * MAZE_CONFIG.gridSize;
        this.canvas.height = 2 * MAZE_CONFIG.offsetY + MAZE_CONFIG.gridHeight * MAZE_CONFIG.gridSize;
        
        this.score = 0;
        this.level = 1;
        this.lives = 3;
        this.gameOver = false;
        this.lastTime = 0;
        this.playerSpeed = 4;
        this.enemySpeed = 3;
        this.paused = false;
        
        // Game state management
        this.gameState = Game.STATES.INITIAL;
        this.stateStartTime = 0;
        this.previewDuration = 750; // 0.75 seconds
        this.releaseDuration = 1500; // 1.5 seconds
        this.releaseStartTime = 0;
        this.releasedSerpents = 0;
        
        // Initialize maze
        this.maze = new Maze();
        this.maze.setupLevel(this.level);
        
        this.playerLength = 3;
        this.enemyLength = 5;

        // Initialize serpents
        this.createNewPlayerSerpent();
        
        // Initialize enemy serpents
        const NUM_ENEMIES = 2;
        this.enemySerpents = Array.from({length: NUM_ENEMIES}, (_, i) => 
            new Serpent(
                `Enemy ${i + 1}`,
                LEVEL_ENEMY_START[this.level].x,
                LEVEL_ENEMY_START[this.level].y, 
                this.enemyLength,
                (this.enemyLength < this.playerLength) ? COLORS.ENEMY_VULNERABLE : COLORS.ENEMY,
                this.enemySpeed,
                MAZE_CONFIG.segmentSize,
                this.maze
            )
        );
        
        this.setupControls();
        this.startGame();
    }

    startGame() {
        this.gameState = Game.STATES.INITIAL;
        this.stateStartTime = performance.now();
        this.releasedSerpents = 0;
        
        // Stop all serpents initially
        this.playerSerpent.stop();
        this.enemySerpents.forEach(serpent => serpent.stop());
        
        // Start the game loop
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    updateGameState(timestamp) {
        const stateElapsed = timestamp - this.stateStartTime;
        
        switch (this.gameState) {
            case Game.STATES.INITIAL:
                if (stateElapsed > 500) { // 0.5 seconds
                    this.gameState = Game.STATES.PREVIEW;
                    this.stateStartTime = timestamp;
                    if (MAZE_CONFIG.debugLogging) console.log(`Game state transition to PREVIEW`);
                }
                break;
                
            case Game.STATES.PREVIEW:
                if (stateElapsed > this.previewDuration) {
                    this.gameState = Game.STATES.DOORS_OPENING;
                    this.stateStartTime = timestamp;
                    this.releaseStartTime = timestamp;
                    this.maze.startEnemyDoorAnimation(1); // Start opening the enemy door
                    this.maze.startPlayerDoorAnimation(1);
                    if (MAZE_CONFIG.debugLogging) console.log(`Game state transition to DOORS_OPENING`);
                }
                break;
                
            case Game.STATES.DOORS_OPENING:
                // Update maze (which includes door animation)
                this.maze.update();
                
                // If door is fully open and animation is complete
                if (this.maze.getEnemyDoorProgress() >= 1 && this.maze.isEnemyDoorAnimationComplete() && this.maze.getPlayerDoorProgress() >= 1 && this.maze.isPlayerDoorAnimationComplete()) {
                    this.gameState = Game.STATES.RELEASING;
                    this.stateStartTime = timestamp;
                    this.releaseStartTime = timestamp;
                    if (MAZE_CONFIG.debugLogging) console.log(`Game state transition to RELEASING`);
                }
                break;

            case Game.STATES.RELEASING:
                let timeSinceLastRelease = timestamp - this.releaseStartTime;
                // Start releasing serpents with a delay between each
                if (this.releasedSerpents < this.enemySerpents.length) {
                    // Check if it's time to release the next serpent                    
                    if (this.releasedSerpents === 0 || timeSinceLastRelease >= this.releaseDuration) {
                        if (MAZE_CONFIG.debugLogging) console.log(`Releasing serpent ${this.releasedSerpents}`);
                        this.enemySerpents[this.releasedSerpents].resume(0, -1); // Start moving up
                        this.releasedSerpents++;
                        this.releaseStartTime = timestamp;
                        timeSinceLastRelease = timestamp - this.releaseStartTime;
                        
                        // Release player serpent after the first enemy serpent
                        if (this.releasedSerpents === 1) {
                            this.playerSerpent.resume(0, -1); // Start moving up
                        }
                    }
                }
                
                // If all serpents are released, start closing the door after the delay
                if ((this.releasedSerpents >= this.enemySerpents.length) && (timeSinceLastRelease >= this.releaseDuration)) {
                    this.gameState = Game.STATES.DOORS_CLOSING;
                    this.stateStartTime = timestamp;
                    this.maze.startEnemyDoorAnimation(-1); // Start closing the enemy door
                    this.maze.startPlayerDoorAnimation(-1); // Start closing the player door
                    if (MAZE_CONFIG.debugLogging) console.log(`Game state transition to DOORS_CLOSING`);
                }
                break;
            
            case Game.STATES.DOORS_CLOSING:
                // Update maze (which includes door animation)
                this.maze.update();
                
                // If door is fully closed after releasing all serpents, move to playing state
                if (this.maze.getEnemyDoorProgress() <= 0 && this.maze.isEnemyDoorAnimationComplete() && this.maze.getPlayerDoorProgress() <= 0 && this.maze.isPlayerDoorAnimationComplete()) {
                    this.gameState = Game.STATES.PLAYING;
                    this.stateStartTime = timestamp;
                    if (MAZE_CONFIG.debugLogging) console.log(`Game state transition to PLAYING`);
                }
                break;
                
            case Game.STATES.PLAYER_DEATH_WAIT:
                if (this.playerSerpent.isDeathAnimationComplete()) {
                    this.createNewPlayerSerpent();
                    
                    // Check for game over
                    if (this.lives <= 0) {
                        this.gameState = Game.STATES.GAME_OVER;
                        this.stateStartTime = timestamp;
                        if (MAZE_CONFIG.debugLogging) console.log(`Game state transition to GAME_OVER`);
                    } else {
                        this.gameState = Game.STATES.PLAYER_RESPAWN_WAIT;
                        this.stateStartTime = timestamp;
                        if (MAZE_CONFIG.debugLogging) console.log(`Game state transition to PLAYER_RESPAWN_WAIT`);
                    }
                }
                break;
                
            case Game.STATES.PLAYER_RESPAWN_WAIT:
                // Wait for 1 second before letting the respawned player move
                if (stateElapsed > 1000) {
                    // Start player door animation for respawn
                    this.maze.startPlayerDoorAnimation(1); // Start opening the player door
                    this.gameState = Game.STATES.PLAYER_RESPAWN;
                    this.stateStartTime = timestamp;
                    if (MAZE_CONFIG.debugLogging) console.log(`Game state transition to PLAYER_RESPAWN`);
                }
                break;
                
            case Game.STATES.PLAYER_RESPAWN:
                // Update maze (which includes door animation)
                this.maze.update();
                
                // If door is fully open and animation is complete
                if (this.maze.getPlayerDoorProgress() >= 1 && this.maze.isPlayerDoorAnimationComplete()) {
                    // Release the player serpent
                    this.playerSerpent.resume(0, -1); // Start moving up
                    
                    // Wait for 1 second before closing the door
                    if (stateElapsed > 1000) {
                        this.gameState = Game.STATES.DOORS_CLOSING;
                        this.stateStartTime = timestamp;
                        this.maze.startPlayerDoorAnimation(-1); // Start closing the player door
                        if (MAZE_CONFIG.debugLogging) console.log(`Game state transition to DOORS_CLOSING`);
                    }
                }
                break;
                
            case Game.STATES.PLAYING:
                if (this.gameOver) {
                    this.gameState = Game.STATES.GAME_OVER;
                    this.stateStartTime = timestamp;
                    if (MAZE_CONFIG.debugLogging) console.log(`Game state transition to GAME_OVER`);
                }
                break;
                
            case Game.STATES.GAME_OVER:
                break;
        }
    }

    createNewPlayerSerpent() {
        this.playerSerpent = new Serpent(
            'Player',
            LEVEL_PLAYER_START[this.level].x,
            LEVEL_PLAYER_START[this.level].y,
            this.playerLength,
            COLORS.PLAYER,
            this.playerSpeed,
            MAZE_CONFIG.segmentSize,
            this.maze
        );
    }

    setupControls() {
        document.addEventListener('keydown', (event) => {
            if (this.gameOver) return;

            // Prevent arrow keys from scrolling the page
            if (CONTROLS.UP.includes(event.key) || 
                CONTROLS.DOWN.includes(event.key) || 
                CONTROLS.LEFT.includes(event.key) || 
                CONTROLS.RIGHT.includes(event.key)) {
                event.preventDefault();
            }

            // Handle pause/resume with 'p'
            if (event.key === 'p') {
                if (this.paused) {
                    this.paused = false;
                    this.playerSerpent.resume(this.playerSerpent.direction.x, this.playerSerpent.direction.y);
                    for (const enemy of this.enemySerpents) {
                        enemy.resume(enemy.direction.x, enemy.direction.y);
                    }
                } else {
                    this.paused = true;
                    this.playerSerpent.stop();
                    for (const enemy of this.enemySerpents) {
                        enemy.stop();
                    }
                }
                return;
            }

            // Don't process movement if game is paused
            if (this.paused) return;

            let direction = { x: 0, y: 0 };

            // Set direction based on key pressed
            if (CONTROLS.UP.includes(event.key)) {
                direction.y = -1;
            } else if (CONTROLS.DOWN.includes(event.key)) {
                direction.y = 1;
            } else if (CONTROLS.LEFT.includes(event.key)) {
                direction.x = -1;
            } else if (CONTROLS.RIGHT.includes(event.key)) {
                direction.x = 1;
            }

            // If a direction key was pressed, log the new direction request with the serpent
            if (direction.x !== 0 || direction.y !== 0) {
                if (this.playerSerpent.stopped) {
                    this.playerSerpent.resume(direction.x, direction.y);
                } else {
                    this.playerSerpent.setDirection(direction.x, direction.y);
                }
            }
        });
    }

    handleCollisions() {
        // Check for collisions between player and enemy serpents
        for (let i = 0; i < this.enemySerpents.length; i++) {
            const enemy = this.enemySerpents[i];
            const collision = this.playerSerpent.checkCollision(enemy);
            
            if (collision) {
                if (collision.type === 'head') {
                    // Head-on collision
                    if (enemy.color === COLORS.ENEMY_VULNERABLE) { // Green serpent
                        // Player wins, eliminate enemy and grow
                        this.enemySerpents.splice(i, 1);
                        this.playerSerpent.grow();
                        this.score += 100;
                        i--; // Adjust index after removal
                    } else {
                        // Player loses a life
                        this.handlePlayerDeath();
                    }
                } else if (collision.type === 'body') {
                    // Player hit enemy's body - shorten the enemy
                    enemy.shrink(enemy.segments.length - collision.segment);
                    this.score += 50;
                    
                    // If enemy is shorter than player, turn it green
                    if (enemy.getLength() < this.playerSerpent.getLength()) {
                        enemy.color = COLORS.ENEMY_VULNERABLE;
                    }
                }
                return; // Exit after handling first collision
            }

            // Check enemy-to-player collisions
            const enemyToPlayerCollision = enemy.checkCollision(this.playerSerpent);
            if (enemyToPlayerCollision && enemyToPlayerCollision.type === 'body') {
                // Enemy hit player's body - shorten the player
                this.playerSerpent.shrink(this.playerSerpent.segments.length - enemyToPlayerCollision.segment);
                
                // Check if any enemies should turn green based on new player length
                for (let j = 0; j < this.enemySerpents.length; j++) {
                    if (this.enemySerpents[j].getLength() >= this.playerSerpent.getLength()) {
                        this.enemySerpents[j].color = COLORS.ENEMY;
                    }
                }
                return; // Exit after handling collision
            }
        }
    }

    handlePlayerDeath() {
        // Decrement lives
        this.lives--;
                
        // Start death animation for player serpent
        this.playerSerpent.startDeathAnimation();
        
        // Transition to player respawn state
        // First transition to a wait state to give player time to orient
        this.gameState = Game.STATES.PLAYER_DEATH_WAIT;
        this.stateStartTime = performance.now();
        if (MAZE_CONFIG.debugLogging) console.log(`Game state transition to PLAYER_DEATH_WAIT`);
    }

    enemySerpentAI(serpent) {
        const head = serpent.segments[0];
        const wall = this.maze.getWall(head.x, head.y);
        let possibleTurns = [];        

        if (this.paused) {
            return;
        }

        // Determine if any turns are possible
        if (serpent.direction.y < 0) {
            // Moving vertically up
            if (!(wall & WALL_TYPES.LEFT)) {
                possibleTurns.push({ x: -1, y: 0 });
            }
            if (!(wall & WALL_TYPES.RIGHT)) {
                possibleTurns.push({ x: 1, y: 0 });
            }
            if (!(wall & WALL_TYPES.UP)) {
                // Bias towards continuing in current direction
                possibleTurns.push({ x: 0, y: -1 });
                possibleTurns.push({ x: 0, y: -1 });
            }
            // Only if dead-end and not a door, turn around
            if (wall === (WALL_TYPES.LEFT|WALL_TYPES.RIGHT|WALL_TYPES.TOP)) {
                possibleTurns.push({ x: 0, y: 1 });
            }
        } else if (serpent.direction.y > 0) {
            // Moving vertically down
            if (!(wall & WALL_TYPES.LEFT)) {
                possibleTurns.push({ x: -1, y: 0 });
            }
            if (!(wall & WALL_TYPES.RIGHT)) {
                possibleTurns.push({ x: 1, y: 0 });
            }
            if (!(wall & WALL_TYPES.DOWN)) {
                // Bias towards continuing in current direction
                possibleTurns.push({ x: 0, y: 1 });
                possibleTurns.push({ x: 0, y: 1 });
            }
            // Only if dead-end and not a door, turn around
            if (wall === (WALL_TYPES.LEFT|WALL_TYPES.RIGHT|WALL_TYPES.BOTTOM)) {
                possibleTurns.push({ x: 0, y: -1 });
            }
        } else if (serpent.direction.x < 0) {
            // Moving horizontally left
            if (!(wall & WALL_TYPES.UP)) {
                possibleTurns.push({ x: 0, y: -1 });
            }
            if (!(wall & WALL_TYPES.DOWN)) {
                possibleTurns.push({ x: 0, y: 1 });
            }
            if (!(wall & WALL_TYPES.LEFT)) {
                // Bias towards continuing in current direction
                possibleTurns.push({ x: -1, y: 0 });
                possibleTurns.push({ x: -1, y: 0 });
            }
            // Only if dead-end and not a door, turn around
            if (wall === (WALL_TYPES.TOP|WALL_TYPES.BOTTOM|WALL_TYPES.LEFT)) {
                possibleTurns.push({ x: 1, y: 0 });
            }
        } else if (serpent.direction.x > 0) {
            // Moving horizontally right
            if (!(wall & WALL_TYPES.UP)) {
                possibleTurns.push({ x: 0, y: -1 });
            }
            if (!(wall & WALL_TYPES.DOWN)) {
                possibleTurns.push({ x: 0, y: 1 });
            }
            if (!(wall & WALL_TYPES.RIGHT)) {
                // Bias towards continuing in current direction
                possibleTurns.push({ x: 1, y: 0 });
                possibleTurns.push({ x: 1, y: 0 });
            }
            // Only if dead-end and not a door, turn around
            if (wall === (WALL_TYPES.TOP|WALL_TYPES.BOTTOM|WALL_TYPES.RIGHT)) {
               possibleTurns.push({ x: -1, y: 0 });
            }
        }
        if (possibleTurns.length > 0) {
            const randomizedTurn = Math.floor(Math.random() * possibleTurns.length);
            const nextDirection = possibleTurns[randomizedTurn];
            if (nextDirection.x !== 0 || nextDirection.y !== 0) {
                if (serpent.stopped) {
                    serpent.resume(nextDirection.x, nextDirection.y);
                } else {
                    serpent.setDirection(nextDirection.x, nextDirection.y);
                }
            }
        }
    }

    drawDebugInfo() {
        if (!MAZE_CONFIG.debug) return;
        
        // Set text properties to match grid square numbers
        this.ctx.fillStyle = '#555555';  // Same color as grid numbers
        this.ctx.font = '12px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        
        // Position text in margin below playing area
        const debugX = MAZE_CONFIG.offsetX;
        let   debugY = MAZE_CONFIG.offsetY + MAZE_CONFIG.gridHeight * MAZE_CONFIG.gridSize + 10;
        
        // Draw current game state
        this.ctx.fillText(`Game State: ${this.gameState}`, debugX, debugY);
        debugY += 15;
        
        // Draw door animation progress if in releasing state
        if (this.gameState === Game.STATES.RELEASING) {
            this.ctx.fillText(`Released Serpents: ${this.releasedSerpents}/${this.enemySerpents.length}`, debugX, debugY);
        } else if (this.gameState === Game.STATES.DOORS_OPENING || this.gameState === Game.STATES.DOORS_CLOSING) {
            this.ctx.fillText(`Enemy Door Progress: ${this.maze.getEnemyDoorProgress().toFixed(2)}`, debugX, debugY);
        }
        
        // Draw player door progress if in player respawn state
        if (this.gameState === Game.STATES.PLAYER_RESPAWN) {
            debugY += 15;
            this.ctx.fillText(`Player Door Progress: ${this.maze.getPlayerDoorProgress().toFixed(2)}`, debugX, debugY);
        }
        
        // Draw wait time if in player respawn wait state
        if (this.gameState === Game.STATES.PLAYER_RESPAWN_WAIT) {
            debugY += 15;
            const waitTime = 750 - (performance.now() - this.stateStartTime);
            this.ctx.fillText(`Respawn Wait: ${Math.max(0, Math.ceil(waitTime/1000 * 10) / 10)}s`, debugX, debugY);
        }
    }
    
    gameLoop(timestamp) {
        // Calculate delta time
        const deltaTime = timestamp - this.lastTime;
        
        // Limit to 60 FPS (approximately 16.67ms per frame)
        if (deltaTime < 16.67) {
            requestAnimationFrame(this.gameLoop.bind(this));
            return;
        }
        
        this.lastTime = timestamp;

        // Update game state
        this.updateGameState(timestamp);

        // Clear the canvas
        this.ctx.fillStyle = COLORS.BACKGROUND;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw maze (which now includes door animation)
        this.maze.draw(this.ctx);

        // Update and draw based on game state
        switch (this.gameState) {
            case Game.STATES.INITIAL:
            case Game.STATES.PREVIEW:
                // Just draw serpents in their initial positions
                this.playerSerpent.draw(this.ctx);
                this.enemySerpents.forEach(serpent => serpent.draw(this.ctx));
                break;
                
            case Game.STATES.DOORS_OPENING:
            case Game.STATES.DOORS_CLOSING:
            case Game.STATES.RELEASING:
            case Game.STATES.PLAYING:
            case Game.STATES.PLAYER_DEATH_WAIT:
            case Game.STATES.PLAYER_RESPAWN_WAIT:
            case Game.STATES.PLAYER_RESPAWN:
                // Update maze (which includes door animation)
                this.maze.update();
                
                // Update and draw serpents
                this.playerSerpent.update();
                this.enemySerpents.forEach((serpent, index) => {
                    // Only apply AI to serpents that have been released and are not dying
                    if (index < this.releasedSerpents && !serpent.isDying) {
                        this.enemySerpentAI(serpent);
                    }
                    serpent.update();
                });
                
                // Check for collisions only during PLAYING state
                if (this.gameState === Game.STATES.PLAYING) {
                    this.handleCollisions();
                }
                
                // Draw all serpents
                this.playerSerpent.draw(this.ctx);
                this.enemySerpents.forEach(serpent => serpent.draw(this.ctx));
                break;
                
            case Game.STATES.GAME_OVER:
                this.drawGameOver();
                break;
        }
        
        // Draw UI elements (header, score, lives) for all states except game over
        if (this.gameState !== Game.STATES.GAME_OVER) {
            // Draw header text
            this.ctx.fillStyle = COLORS.TEXT;
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText('Serpentine', MAZE_CONFIG.offsetX, MAZE_CONFIG.offsetY/2);
            this.ctx.textAlign = 'center';
            this.ctx.fillText(`Level ${this.level}`, MAZE_CONFIG.offsetX + MAZE_CONFIG.gridWidth * MAZE_CONFIG.gridSize / 2, MAZE_CONFIG.offsetY/2);
            this.ctx.textAlign = 'right';
            this.ctx.fillText(this.score.toString().padStart(6, '0'), MAZE_CONFIG.offsetX + MAZE_CONFIG.gridWidth * MAZE_CONFIG.gridSize, MAZE_CONFIG.offsetY/2);

            // Draw lives
            this.drawLives();
        }
        
        // Draw debug information if debug mode is enabled
        this.drawDebugInfo();

        // Continue the game loop
        requestAnimationFrame(this.gameLoop.bind(this));
    }

    drawLives() {
        // Draw remaining lives as small serpents in the bottom right
        const startX = MAZE_CONFIG.offsetX + MAZE_CONFIG.gridWidth * MAZE_CONFIG.gridSize;
        const startY = MAZE_CONFIG.offsetY + MAZE_CONFIG.offsetY/2 + MAZE_CONFIG.gridHeight * MAZE_CONFIG.gridSize;
        const spacing = MAZE_CONFIG.segmentSize * 2;

        for (let i = 0; i < this.lives - 1; i++) { // -1 because current serpent counts as a life
            this.ctx.fillStyle = COLORS.LIVES;
            this.ctx.beginPath();
            this.ctx.arc(startX - (i * spacing), startY, MAZE_CONFIG.segmentSize / 2, 0, Math.PI * 2);
            this.ctx.fill();
        }
    }

    drawGameOver() {
        this.ctx.fillStyle = COLORS.GAME_OVER;
        this.ctx.font = '40px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.font = '20px Arial';
        this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 40);
    }
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    const game = new Game();
}); 