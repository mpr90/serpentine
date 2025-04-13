class Serpent {
    constructor(name, gridIndexX, gridIndexY, initialLength, color, speed, segmentSize = 8, maze) {
        this.name = name;
        this.segments = [];
        this.speed = speed;
        this.color = color;
        this.segmentSize = segmentSize;
        this.headSize = segmentSize;
        this.direction = { x: 0, y: -1 }; // Start moving up
        this.nextDirection = { x: 0, y: -1 }; // Start moving up
        this.segmentSpacing = segmentSize * 1.1; // Spacing is 2.5 times the segment size
        this.stopped = true;
        this.lastMoveTime = 0;
        this.moveInterval = 1000 / speed; // Time between moves in ms
                
        // Death animation properties
        this.isDying = false;
        this.deathProgress = 0; // 0 to 1
        this.deathSpeed = 0.015; // How fast the death animation progresses
        this.deathStartTime = 0;
        
        // Each segment needs its own direction and turning points queue
        this.segmentDirections = [];
        this.segmentTurningPoints = [];
        
        // Initialize segments starting from grid square (gridIndexX, gridIndexY)
        for (let i = 0; i < initialLength; i++) {
            this.segments.push({
                x: gridIndexX * MAZE_CONFIG.gridSize + MAZE_CONFIG.offsetX + (MAZE_CONFIG.gridSize / 2),
                y: gridIndexY * MAZE_CONFIG.gridSize + MAZE_CONFIG.offsetY + (MAZE_CONFIG.gridSize / 2) + (i * this.segmentSpacing) // Stack segments vertically, with head at top
            });
            // Initialize each segment's direction to match the serpent's direction
            this.segmentDirections.push({ ...this.direction });
            // Initialize empty turning points queue for each segment
            this.segmentTurningPoints.push([]);
        }

        this.maze = maze; // Store reference to maze
    }

    // Update serpent position based on current direction and speed
    update() {
        // If the serpent is dying, update the death animation
        if (this.isDying) {
            this.deathProgress += this.deathSpeed;
            if (this.deathProgress >= 1) {
                // Animation complete, serpent is fully dead
                this.deathProgress = 1;
            }
            return;
        }
        if (this.stopped) {
            return; // Don't update positions if stopped
        }
        // Shorthand for head segment
        const head = this.segments[0];
        let nextHeadX = head.x + this.direction.x * this.speed;
        let nextHeadY = head.y + this.direction.y * this.speed;

        // Check if direction is changing
        if ((this.nextDirection.x !== this.direction.x || this.nextDirection.y !== this.direction.y) &&
            (this.nextDirection.x !== 0 || this.nextDirection.y !== 0)) {

            // Calculate which grid square the head is heading towards
            let gridIndexX, gridIndexY;

            if (this.direction.x > 0) { // Moving right
                gridIndexX = Math.ceil((head.x - (MAZE_CONFIG.gridSize/2) - MAZE_CONFIG.offsetX) / MAZE_CONFIG.gridSize);
            } else if (this.direction.x < 0) { // Moving left
                gridIndexX = Math.floor((head.x - (MAZE_CONFIG.gridSize/2) - MAZE_CONFIG.offsetX) / MAZE_CONFIG.gridSize);
            } else { // Moving vertically
                gridIndexX = Math.round((head.x - (MAZE_CONFIG.gridSize/2) - MAZE_CONFIG.offsetX) / MAZE_CONFIG.gridSize);
            }

            if (this.direction.y > 0) { // Moving down
                gridIndexY = Math.ceil((head.y - (MAZE_CONFIG.gridSize/2) - MAZE_CONFIG.offsetY) / MAZE_CONFIG.gridSize);
            } else if (this.direction.y < 0) { // Moving up
                gridIndexY = Math.floor((head.y - (MAZE_CONFIG.gridSize/2) - MAZE_CONFIG.offsetY) / MAZE_CONFIG.gridSize);
            } else { // Moving horizontally
                gridIndexY = Math.round((head.y - (MAZE_CONFIG.gridSize/2) - MAZE_CONFIG.offsetY) / MAZE_CONFIG.gridSize);
            }

            // Calculate the center of the target grid square
            const gridX = MAZE_CONFIG.offsetX + (gridIndexX * MAZE_CONFIG.gridSize) + (MAZE_CONFIG.gridSize / 2);
            const gridY = MAZE_CONFIG.offsetY + (gridIndexY * MAZE_CONFIG.gridSize) + (MAZE_CONFIG.gridSize / 2);

            // Calculate the distance to the grid center point
            const distanceToGridCenterPoint = this.distanceBetween(head, {x: gridX, y: gridY});

            // If the distance to the grid center point is less than the speed, we need to turn
            if (distanceToGridCenterPoint < this.speed) {
                // Calculate the next head position by splitting the movement into two parts
                nextHeadX = head.x + this.direction.x * distanceToGridCenterPoint + this.nextDirection.x * (this.speed - distanceToGridCenterPoint);
                nextHeadY = head.y + this.direction.y * distanceToGridCenterPoint + this.nextDirection.y * (this.speed - distanceToGridCenterPoint);
                
                // If there would not be a collision with a wall, we can turn
                if (!this.checkWallCollision(nextHeadX, nextHeadY, this.nextDirection)) {
                    // Store turning point for segments to follow
                    const turningPoint = {
                        x: gridX,
                        y: gridY,
                        direction: { ...this.nextDirection }
                    };
                    
                    // Add turning point to all segment queues
                    for (let i = 0; i < this.segments.length; i++) {
                        this.segmentTurningPoints[i].push({ ...turningPoint });
                    }
                    
                    // Update direction
                    this.direction = { ...this.nextDirection };
                    this.segmentDirections[0] = { ...this.direction };
                    
                    if (MAZE_CONFIG.serpentDebugLogging) {
                        console.log(`${this.name} turning at: (${head.x}, ${head.y}), Grid center: (${gridX}, ${gridY}), Distance to grid center: ${distanceToGridCenterPoint}, Direction: (${this.direction.x}, ${this.direction.y}), Next direction: (${this.nextDirection.x}, ${this.nextDirection.y})`);
                    }
                } else {
                    // put back the original new position without the turn
                    nextHeadX = head.x + this.direction.x * this.speed;
                    nextHeadY = head.y + this.direction.y * this.speed;
                    if (MAZE_CONFIG.serpentDebugLogging) {
                        console.log(`${this.name} would collide with a wall, skipping turn. Head: (${head.x}, ${head.y}), Grid center: (${gridX}, ${gridY}), Distance to grid center: ${distanceToGridCenterPoint}, Direction: (${this.direction.x}, ${this.direction.y}), Next direction: (${this.nextDirection.x}, ${this.nextDirection.y})`);
                    }
                }
            } else {
                if (MAZE_CONFIG.serpentDebugLogging) {
                    console.log(`${this.name} is not close enough to grid center point, skipping turn. Head: (${head.x}, ${head.y}), Grid center: (${gridX}, ${gridY}), Distance: ${distanceToGridCenterPoint}`);
                }
            }
        }

        // Check if this movement would cause a collision with a wall
        const wouldCollide = this.checkWallCollision(nextHeadX, nextHeadY, this.direction);
        
        if (wouldCollide) {
            this.stop();
            return;
        }

        // If no collision, update head position
        head.x = nextHeadX;
        head.y = nextHeadY;

        // Update body segments
        for (let i = 1; i < this.segments.length; i++) {
            const segment = this.segments[i];
            const turningPoints = this.segmentTurningPoints[i];

            // Check if segment has reached its next turning point
            if (turningPoints.length > 0) {
                const point = turningPoints[0];
                const distanceToPoint = this.distanceBetween(segment, point);
                
                if (distanceToPoint < this.speed) {
                    // Log head and first segment positions
                    if (MAZE_CONFIG.serpentDebugLogging) {
                        console.log(`${this.name}: Segment ${i} turning at (${point.x}, ${point.y}), Head position: (${head.x}, ${head.y}), segment: (${segment.x}, ${segment.y}), Distance: ${this.distanceBetween(head, segment)}`);
                    }

                    // Segment is close enough to turning point, update its location and direction
                    segment.x += this.segmentDirections[i].x * distanceToPoint + point.direction.x * (this.speed - distanceToPoint);
                    segment.y += this.segmentDirections[i].y * distanceToPoint + point.direction.y * (this.speed - distanceToPoint);
                    this.segmentDirections[i] = { ...point.direction };
                    
                    // Remove the turning point from this segment's queue
                    turningPoints.shift();

                } else {
                    // Not turning yet, simple calculation for next segment position
                    segment.x += this.segmentDirections[i].x * this.speed;
                    segment.y += this.segmentDirections[i].y * this.speed;
                }
            } else {
                // No turning points, simple calculation for next segment position
                segment.x += this.segmentDirections[i].x * this.speed;
                segment.y += this.segmentDirections[i].y * this.speed;
            }
        }

        if (MAZE_CONFIG.serpentDebugLogging) {
            if (this.segments.length > 1) {
                console.log(`  ${this.name}: Head position: (${head.x}, ${head.y}), First segment position: (${this.segments[1].x}, ${this.segments[1].y}), Distance: ${this.distanceBetween(head, this.segments[1])}`);
            } else {
                console.log(`  ${this.name}: Head position: (${head.x}, ${head.y}), No segments`);
            }
        }
    }

    // Stop all movement
    stop() {
        this.stopped = true;
    }

    // Resume movement in a given direction
    resume(dx, dy) {
        this.stopped = false;
        this.setDirection(dx, dy);
    }

    // Set the next direction of movement (to be applied on next update)
    setDirection(dx, dy) {
        // Only set new direction if it's different from current direction
        if (dx !== this.direction.x || dy !== this.direction.y) {
            this.nextDirection = { x: dx, y: dy };
        }
    }

    // Add a new segment to the tail
    grow() {
        const tail = this.segments[this.segments.length - 1];
        const tailDirection = this.segmentDirections[this.segments.length - 1];
        const turningPoints = this.segmentTurningPoints[this.segments.length - 1];

        // Add new segment behind the tail in the same direction
        const newTail = {
            x: tail.x - (tailDirection.x * this.segmentSpacing),
            y: tail.y - (tailDirection.y * this.segmentSpacing)
        };
        this.segments.push(newTail);
        this.segmentDirections.push({ ...tailDirection });
        this.segmentTurningPoints.push([...turningPoints]);
    }

    // Remove segments from the tail
    shrink(numSegments = 1) {
        for (let i = 0; i < numSegments && this.segments.length > 2; i++) {
            this.segments.pop();
            this.segmentDirections.pop();
            this.segmentTurningPoints.pop();
        }
    }

    // Draw the serpent
    draw(ctx) {
        if (this.isDying) {
            // Draw dying animation - head shrinks to a point
            const head = this.segments[0];
            const headSize = this.segmentSize / 2 * (1 - this.deathProgress);
            
            // Draw the shrinking head
            ctx.fillStyle = this.color;
            ctx.beginPath();
            // Draw body segment
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(
                head.x,
                head.y,
                headSize,
                0,
                Math.PI * 2
            );
            ctx.fill();

            // Draw the rest of the body with fading opacity
            for (let i = 1; i < this.segments.length; i++) {
                const segment = this.segments[i];
                const opacity = Math.max(0, 1 - this.deathProgress * 2); // Body fades out faster than head
                
                ctx.fillStyle = `rgba(${this.getRGBValues()}, ${opacity})`;
                ctx.beginPath();
                ctx.arc(
                    segment.x,
                    segment.y,
                    this.segmentSize / 2,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
        } else {
            // Normal drawing
            this.segments.forEach((segment, index) => {
                // Draw head with eyes
                if (index === 0) {
                    ctx.fillStyle = this.color;
                    ctx.beginPath();
                    ctx.arc(
                        segment.x,
                        segment.y,
                        this.segmentSize / 2,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                    
                    // Draw eyes
                    ctx.fillStyle = 'white';
                    const eyeSize = this.segmentSize / 6;
                    const eyeOffset = this.segmentSize / 4;
                    
                    // Position eyes based on direction
                    let leftEyeX, leftEyeY, rightEyeX, rightEyeY;
                    
                    if (this.direction.x > 0) { // Moving right
                        leftEyeX = segment.x + this.segmentSize / 2 - eyeOffset;
                        leftEyeY = segment.y - eyeOffset;
                        rightEyeX = segment.x + this.segmentSize / 2 - eyeOffset;
                        rightEyeY = segment.y + eyeOffset;
                    } else if (this.direction.x < 0) { // Moving left
                        leftEyeX = segment.x - this.segmentSize / 2 + eyeOffset;
                        leftEyeY = segment.y - eyeOffset;
                        rightEyeX = segment.x - this.segmentSize / 2 + eyeOffset;
                        rightEyeY = segment.y + eyeOffset;
                    } else if (this.direction.y > 0) { // Moving down
                        leftEyeX = segment.x - eyeOffset;
                        leftEyeY = segment.y + this.segmentSize / 2 - eyeOffset;
                        rightEyeX = segment.x + eyeOffset;
                        rightEyeY = segment.y + this.segmentSize / 2 - eyeOffset;
                    } else { // Moving up or stationary
                        leftEyeX = segment.x - eyeOffset;
                        leftEyeY = segment.y - this.segmentSize / 2 + eyeOffset;
                        rightEyeX = segment.x + eyeOffset;
                        rightEyeY = segment.y - this.segmentSize / 2 + eyeOffset;
                    }
    
                    ctx.beginPath();
                    ctx.arc(leftEyeX, leftEyeY, eyeSize, 0, Math.PI * 2);
                    ctx.arc(rightEyeX, rightEyeY, eyeSize, 0, Math.PI * 2);
                    ctx.fill();
                    
                    // Draw pupils
                    ctx.fillStyle = 'black';
                    ctx.beginPath();
                    ctx.arc(leftEyeX, leftEyeY, eyeSize / 2, 0, Math.PI * 2);
                    ctx.arc(rightEyeX, rightEyeY, eyeSize / 2, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Draw body segment
                    ctx.fillStyle = this.color;
                    ctx.beginPath();
                    ctx.arc(
                        segment.x,
                        segment.y,
                        this.segmentSize / 2,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();

                    // Draw body segment front
                    let startAngle, endAngle;
                    if (this.segmentDirections[index].x > 0) { // Moving right
                        startAngle = 7*Math.PI/4;
                        endAngle = Math.PI/4;
                    } else if (this.segmentDirections[index].x < 0) { // Moving left
                        startAngle = 3*Math.PI/4;
                        endAngle = 5*Math.PI/4;
                    } else if (this.segmentDirections[index].y > 0) { // Moving down
                        startAngle = Math.PI/4;
                        endAngle = 3*Math.PI/4;
                    } else if (this.segmentDirections[index].y < 0) { // Moving up
                        startAngle = 5*Math.PI/4;
                        endAngle = 7*Math.PI/4;
                    }

                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.arc(segment.x, segment.y, this.segmentSize / 2 - 2, startAngle, endAngle);
                    ctx.stroke();
                }
            });
        }
    }

    // Check collision with another serpent
    checkCollision(otherSerpent) {
        const head = this.segments[0];
        
        // Check head-to-head collision
        const otherHead = otherSerpent.segments[0];
        const headCollisionDistance = this.headSize + otherSerpent.headSize;
        const headCollision = this.distanceBetween(head, otherHead) < headCollisionDistance;
        
        if (headCollision) {
            return { type: 'head', segment: 0 };
        }

        // Check collision with other serpent's body
        for (let i = 1; i < otherSerpent.segments.length; i++) {
            const segment = otherSerpent.segments[i];
            const collisionDistance = this.headSize + otherSerpent.segmentSize;
            if (this.distanceBetween(head, segment) < collisionDistance) {
                return { type: 'body', segment: i };
            }
        }

        return null;
    }

    // Helper function to calculate distance between points
    distanceBetween(point1, point2) {
        const dx = point1.x - point2.x;
        const dy = point1.y - point2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Check if point is within game bounds
    checkBounds(width, height) {
        const head = this.segments[0];
        return head.x >= 0 && head.x <= width && 
               head.y >= 0 && head.y <= height;
    }

    // Get the current length of the serpent
    getLength() {
        return this.segments.length;
    }

    // Check if a position would cause a wall collision
    checkWallCollision(x, y, direction) {
        let gridIndexX = Math.floor((x - MAZE_CONFIG.offsetX) / MAZE_CONFIG.gridSize);
        let gridIndexY = Math.floor((y - MAZE_CONFIG.offsetY) / MAZE_CONFIG.gridSize);
        
        // Check if position is out of bounds
        if (gridIndexX < 0 || gridIndexX >= MAZE_CONFIG.gridWidth || 
            gridIndexY < 0 || gridIndexY >= MAZE_CONFIG.gridHeight) {
            return true;
        }
                
        // Calculate distance to nearest wall in the direction of travel
        const distanceToWall = this.calculateDistanceToNearestWallInDirection(x, y, gridIndexX, gridIndexY, direction);
        
        // Collision if closer than half grid size
        return distanceToWall < MAZE_CONFIG.gridSize / 2;
    }

    calculateDistanceToNearestWallInDirection(x, y, gridX, gridY, direction) {
        // Get the wall type at this position
        const wallType = this.maze.walls[gridY][gridX];
        
        // Calculate distances to each wall type
        let minDistance = Infinity;
        
        // Distance to top wall
        if (direction.y < 0 && (wallType & WALL_TYPES.TOP)) {
            const distanceToTop = Math.abs(y - (MAZE_CONFIG.offsetY + gridY * MAZE_CONFIG.gridSize));
            minDistance = Math.min(minDistance, distanceToTop);
        }
        
        // Distance to right wall
        if (direction.x > 0 && (wallType & WALL_TYPES.RIGHT)) {
            const distanceToRight = Math.abs(x - (MAZE_CONFIG.offsetX + (gridX + 1) * MAZE_CONFIG.gridSize));
            minDistance = Math.min(minDistance, distanceToRight);
        }
        
        // Distance to bottom wall
        if (direction.y > 0 && (wallType & WALL_TYPES.BOTTOM)) {
            const distanceToBottom = Math.abs(y - (MAZE_CONFIG.offsetY + (gridY + 1) * MAZE_CONFIG.gridSize));
            minDistance = Math.min(minDistance, distanceToBottom);
        }
        
        // Distance to left wall
        if (direction.x < 0 && (wallType & WALL_TYPES.LEFT)) {
            const distanceToLeft = Math.abs(x - (MAZE_CONFIG.offsetX + gridX * MAZE_CONFIG.gridSize));
            minDistance = Math.min(minDistance, distanceToLeft);
        }
        
        return minDistance;
    }

    // Start the death animation
    startDeathAnimation() {
        this.isDying = true;
        this.deathProgress = 0;
        this.deathStartTime = performance.now();
        this.stopped = true; // Stop movement during death animation
    }
    
    // Check if the death animation is complete
    isDeathAnimationComplete() {
        return this.isDying && this.deathProgress >= 1;
    }

    // Helper method to get RGB values from color string
    getRGBValues() {
        // Extract RGB values from the color string
        // This assumes the color is in the format "rgb(r, g, b)" or a hex color
        if (this.color.startsWith('rgb')) {
            // Extract numbers from rgb(r, g, b) format
            const match = this.color.match(/\d+/g);
            if (match && match.length >= 3) {
                return `${match[0]}, ${match[1]}, ${match[2]}`;
            }
        } else if (this.color.startsWith('#')) {
            // Convert hex to RGB
            const r = parseInt(this.color.substr(1, 2), 16);
            const g = parseInt(this.color.substr(3, 2), 16);
            const b = parseInt(this.color.substr(5, 2), 16);
            return `${r}, ${g}, ${b}`;
        }
        
        // Default fallback
        return '255, 255, 255';
    }
}

// Export the Serpent class
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Serpent };
} 