const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game Constants
const GRAVITY = 0.0625; // Halved falling speed (Eski: 0.125)
const FRICTION = 0.8;
const PLAYER_SPEED = 3.25; // 2x hızlandırıldı (Eski: 1.625)
const JUMP_FORCE = 5; // Reduced to match lower gravity (Eski: 7)

// Colors
const COLOR_PLAYER = '#ffffff';
const COLOR_PLATFORM = '#a0d8ef'; // Icy Blue
const COLOR_HAZARD = '#f80759';
const COLOR_GOAL = '#00f260';
const COLOR_SNOW = '#ffffff';
const COLOR_MOUNTAIN = '#ffffff'; // White snowy mountain

// Game State
let currentState = 'PLAYING'; // PLAYING, PAUSED, GAMEOVER, WIN
let currentLevel = 0;
let cameraY = 0;
let spotlightRadius = 150;
let finaleTimer = 0;

// Inputs
const keys = {
    right: false,
    left: false,
    up: false,
    shoot: false
};

let ammo = 0;
let playerBullets = [];

// --- PERFORMANCE OPTIMIZATIONS ---
const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
const dpr = window.devicePixelRatio || 1;
const useShadows = !isMobile;
let cachedBackground = null;
let cachedPlatforms = null;

// --- CLASSES ---

class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 30;
        this.height = 30;
        this.velX = 0;
        this.velY = 0;
        this.isGrounded = false;
        this.jumpsLeft = 2; // Çift zıplama için
        this.trail = []; // For visual effect
    }

    update() {
        // Input Physics
        if (keys.right) this.velX = PLAYER_SPEED;
        else if (keys.left) this.velX = -PLAYER_SPEED;
        else this.velX *= FRICTION;

        // Apply Gravity
        this.velY += GRAVITY;

        // Apply Velocity
        this.x += this.velX;
        this.y += this.velY;

        // Screen Boundaries (Side walls)
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > canvas.width) this.x = canvas.width - this.width;

        // Trail Effect Logic (Keep history longer for beam)
        if (Math.abs(this.velX) > 0.5 || Math.abs(this.velY) > 0.5) {
            this.trail.push({ x: this.x, y: this.y });
            if (this.trail.length > 10) this.trail.shift();
        } else {
            if (this.trail.length > 0) this.trail.shift(); // Shrink trail when stopped
        }
    }

    jump() {
        if (this.isGrounded || this.jumpsLeft > 0) {
            this.velY = -JUMP_FORCE;
            this.isGrounded = false;
            this.jumpsLeft--;
        }
    }

    shoot() {
        if (ammo > 0) {
            ammo--;
            const ammoDisplay = document.getElementById('ammo-display');
            if (ammoDisplay) ammoDisplay.innerText = ammo;
            const direction = this.velX >= 0 ? 1 : -1;
            playerBullets.push(new Bullet(this.x + this.width / 2, this.y + this.height / 2, direction, true));
        }
    }

    draw() {
        const w = this.width;
        const h = this.height;

        // --- DRAW ORANGE BEAM TRAIL ---
        if (this.trail.length > 1) {
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(this.trail[0].x + w / 2, this.trail[0].y + h / 2);
            for (let i = 1; i < this.trail.length; i++) {
                ctx.lineTo(this.trail[i].x + w / 2, this.trail[i].y + h / 2);
            }
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.lineWidth = w * 0.8;
            ctx.strokeStyle = 'rgba(255, 117, 5, 0.3)'; // Outer glow
            ctx.stroke();

            ctx.lineWidth = w * 0.4;
            ctx.strokeStyle = 'rgba(255, 165, 0, 0.8)'; // Inner core
            ctx.stroke();
            ctx.restore();
        }

        const x = this.x;
        const y = this.y;

        // --- DRAW FOX HEAD ---

        // 1. Ears
        ctx.fillStyle = '#ff7505'; // Fox Orange
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.4);
        ctx.lineTo(x + w * 0.2, y);
        ctx.lineTo(x + w * 0.4, y + h * 0.4);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x + w, y + h * 0.4);
        ctx.lineTo(x + w * 0.8, y);
        ctx.lineTo(x + w * 0.6, y + h * 0.4);
        ctx.fill();

        // 2. Main Face
        ctx.fillStyle = '#ff7505';
        if (useShadows) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff7505';
        }
        ctx.beginPath();
        ctx.moveTo(x, y + h * 0.4);
        ctx.lineTo(x + w * 0.5, y + h); // Bottom point
        ctx.lineTo(x + w, y + h * 0.4);
        ctx.closePath();
        ctx.fill();
        if (useShadows) ctx.shadowBlur = 0;

        // 3. White Cheeks
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.moveTo(x + w * 0.2, y + h * 0.6);
        ctx.lineTo(x + w * 0.5, y + h);
        ctx.lineTo(x + w * 0.8, y + h * 0.6);
        ctx.closePath();
        ctx.fill();

        // 4. Eyes
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.arc(x + w * 0.3, y + h * 0.55, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(x + w * 0.7, y + h * 0.55, 2, 0, Math.PI * 2);
        ctx.fill();

        // 5. Nose
        ctx.beginPath();
        ctx.arc(x + w * 0.5, y + h * 0.9, 2, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Platform {
    constructor(x, y, w, h, type = 'normal') {
        this.x = x;
        this.y = y;
        this.width = w;
        this.height = h;
        this.type = type; // normal, hazard, goal
    }

    draw() {
        const x = this.x;
        const y = this.y;
        const w = this.width;
        const h = this.height;

        ctx.save();
        if (this.type === 'normal') {
            // Organic Stone / Mossy Look
            ctx.fillStyle = '#2c3e50'; // Dark Slate Base

            ctx.beginPath();
            ctx.moveTo(x, y + 5);
            // Rough top surface
            for (let i = 0; i <= w; i += 20) {
                const ry = y + Math.sin(i * 0.1 + x) * 5;
                ctx.lineTo(x + i, ry);
            }
            ctx.lineTo(x + w, y + h);
            ctx.lineTo(x, y + h);
            ctx.closePath();
            ctx.fill();

            // Moss Green Top
            ctx.fillStyle = '#1b4d3e';
            ctx.beginPath();
            ctx.moveTo(x, y + 5);
            for (let i = 0; i <= w; i += 10) {
                const ry = y + Math.sin(i * 0.15 + x) * 4;
                ctx.lineTo(x + i, ry);
            }
            ctx.lineTo(x + w, y + 10);
            ctx.lineTo(x, y + 10);
            ctx.fill();

            // Lotus on moss (if wide)
            if (w > 30) {
                const flowerCount = Math.floor(w / 40);
                for (let i = 0; i < flowerCount; i++) {
                    const fx = x + (i * 40) + 20;
                    const fy = y + Math.sin((i * 40 + 20) * 0.15 + x) * 4;
                    this.drawLotus(fx, fy);
                }
            }
        } else if (this.type === 'hazard') {
            this.drawHeartTrap(x, y, w, h);
        } else if (this.type === 'goal') {
            this.drawSuitcase(x, y, w, h);
        }
        ctx.restore();
    }

    drawSuitcase(x, y, w, h) {
        const bodyColor = '#8b4513'; // Brown
        const strapColor = '#4a2508'; // Dark Brown
        const handleColor = '#d4af37'; // Gold

        ctx.fillStyle = bodyColor;
        // Draw suitcase body a bit above the platform line
        ctx.fillRect(x + w * 0.1, y - 25, w * 0.8, 30);

        // Straps
        ctx.fillStyle = strapColor;
        ctx.fillRect(x + w * 0.25, y - 25, w * 0.1, 30);
        ctx.fillRect(x + w * 0.65, y - 25, w * 0.1, 30);

        // Handle
        ctx.strokeStyle = handleColor;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x + w * 0.5, y - 25, 8, Math.PI, 0);
        ctx.stroke();
    }

    drawLotus(x, y) {
        const petalColor = '#ffb7c5'; // Cherry Blossom Pink
        const centerColor = '#ffd700'; // Gold

        ctx.save();
        ctx.translate(x, y);

        // Petals
        ctx.fillStyle = petalColor;
        for (let i = 0; i < 6; i++) {
            ctx.rotate(Math.PI / 3);
            ctx.beginPath();
            ctx.ellipse(0, -8, 5, 10, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // Center
        ctx.fillStyle = centerColor;
        ctx.beginPath();
        ctx.arc(0, -2, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    drawHeartTrap(x, y, w, h) {
        ctx.save();
        ctx.translate(x + w / 2, y + h / 2);

        // Draw multiple small hearts if wide, else one big one
        const heartCount = Math.max(1, Math.floor(w / 40));
        const spacing = w / heartCount;

        for (let i = 0; i < heartCount; i++) {
            ctx.save();
            ctx.translate((i - (heartCount - 1) / 2) * spacing, 0);

            ctx.fillStyle = '#ff0000'; // Trap Red
            if (useShadows) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = '#ff0000';
            }

            ctx.beginPath();
            const size = 15;
            ctx.moveTo(0, size);
            // Left curve
            ctx.bezierCurveTo(-size, -size / 2, -size * 1.5, size / 2, 0, size * 1.5);
            // Right curve
            ctx.bezierCurveTo(size * 1.5, size / 2, size, -size / 2, 0, size);

            // Simpler heart shape for canvas
            ctx.beginPath();
            const topY = -5;
            ctx.moveTo(0, topY + 5);
            ctx.bezierCurveTo(-5, topY - 5, -15, topY + 5, 0, topY + 18);
            ctx.bezierCurveTo(15, topY + 5, 5, topY - 5, 0, topY + 5);
            ctx.fill();
            if (useShadows) ctx.shadowBlur = 0;
            ctx.restore();
        }

        ctx.restore();
    }
}

class Enemy {
    constructor(platform) {
        this.platform = platform;
        this.width = 40;
        this.height = 30;
        this.x = platform.x + Math.random() * (platform.width - this.width);
        this.y = platform.y - this.height;
        this.speed = (0.6 + Math.random() * 1.4) * (Math.random() > 0.5 ? 1 : -1); // 2x hızlandırıldı (Eski: 0.3 + 0.7)
        this.shootTimer = 0;
        this.shootInterval = 300; // 60 fps * 5 saniye = 300 (Daha seyrek atış)
    }

    update() {
        this.x += this.speed;
        // Keep within platform boundaries
        if (this.x < this.platform.x || this.x + this.width > this.platform.x + this.platform.width) {
            this.speed *= -1;
            this.x += this.speed;
        }

        // Shooting logic with Line of Sight
        this.shootTimer++;
        if (this.shootTimer >= this.shootInterval) {
            if (this.canSeePlayer()) {
                this.shootTimer = 0;
                this.shoot();
            }
        }
    }

    canSeePlayer() {
        const distDX = Math.abs(player.x - this.x);
        const distDY = Math.abs(player.y - this.y);

        // Görüş Alanı: 500px yatay mesafe ve 150px dikey mesafe içinde mi?
        if (distDX < 500 && distDY < 150) {
            // Düşman oyuncuya mı bakıyor?
            const toPlayer = (player.x < this.x) ? -1 : 1;
            const facing = (this.speed < 0) ? -1 : 1;
            return toPlayer === facing;
        }
        return false;
    }

    shoot() {
        // Enforce "seeing" player (simple horizontal check or just shoot towards player)
        const direction = (player.x < this.x) ? -1 : 1;
        bullets.push(new Bullet(this.x + this.width / 2, this.y + this.height / 2, direction));
    }

    draw() {
        const x = this.x;
        const y = this.y;
        const w = this.width;
        const h = this.height;

        // body (Square Wolf)
        ctx.fillStyle = '#4a4a4a'; // Dark Grey
        ctx.fillRect(x, y, w, h);

        // Ears
        ctx.fillStyle = '#4a4a4a';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 10, y - 10);
        ctx.lineTo(x + 15, y);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(x + w, y);
        ctx.lineTo(x + w - 10, y - 10);
        ctx.lineTo(x + w - 15, y);
        ctx.fill();

        // Eyes (Evil red)
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(x + 8, y + 8, 5, 5);
        ctx.fillRect(x + w - 13, y + 8, 5, 5);

        // Mouth/Nose
        ctx.fillStyle = '#000000';
        ctx.fillRect(x + w / 2 - 3, y + h - 8, 6, 4);
    }
}

class Bullet {
    constructor(x, y, dir, isPlayer = false) {
        this.x = x;
        this.y = y;
        this.width = isPlayer ? 15 : 10;
        this.height = 5;
        this.speed = dir * (isPlayer ? 7.0 : 2.0); // 2x hızlandırıldı (Eski: 3.5 : 1)
        this.isPlayer = isPlayer;
    }

    update() {
        this.x += this.speed;
    }

    draw() {
        const color = this.isPlayer ? '#00f260' : '#f80759';
        ctx.save();

        if (useShadows) {
            // --- BULLET GLOW (Aura) ---
            const auraSize = 30; // Increased for better visibility
            const grad = ctx.createRadialGradient(
                this.x + this.width / 2, this.y + this.height / 2, 0,
                this.x + this.width / 2, this.y + this.height / 2, auraSize
            );
            grad.addColorStop(0, this.isPlayer ? 'rgba(0, 242, 96, 0.6)' : 'rgba(248, 7, 89, 0.6)');
            grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height / 2, auraSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- BULLET BODY ---
        ctx.fillStyle = color;
        if (useShadows) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = color;
        }
        ctx.fillRect(this.x, this.y, this.width, this.height);
        if (useShadows) ctx.shadowBlur = 0;
        ctx.restore();
    }
}

class Particle {
    constructor(x, y, color, type = 'heart') {
        this.x = x;
        this.y = y;
        this.type = type; // heart, spirit, drip, dust
        this.size = type === 'spirit' ? Math.random() * 8 + 4 :
            type === 'drip' ? 2 :
                type === 'dust' ? Math.random() * 2 + 1 :
                    Math.random() * 5 + 2;
        this.speedX = type === 'spirit' ? Math.random() * 2 - 1 :
            type === 'dust' ? Math.random() * 1.0 - 0.5 :
                Math.random() * 4 - 2;
        this.speedY = type === 'spirit' ? Math.random() * -1.0 - 0.5 : // 2x hızlandırıldı (Eski: -0.5, -0.25)
            type === 'drip' ? Math.random() * 4 + 2 :
                type === 'dust' ? Math.random() * 0.4 - 0.2 :
                    Math.random() * -4 - 2;
        this.color = color;
        this.life = 1.0;
        this.decay = type === 'spirit' ? 0.005 :
            type === 'dust' ? 0.002 :
                Math.random() * 0.02 + 0.02;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        if (this.type === 'spirit') {
            this.speedX += Math.sin(Date.now() * 0.01) * 0.05; // Wavy movement
        }
        if (this.type === 'drip') {
            this.speedY += 0.05; // Gravity for drips
        }
        this.life -= this.decay;
    }

    draw() {
        ctx.save();
        ctx.globalAlpha = this.life;
        ctx.fillStyle = this.color;

        if (this.type === 'spirit') {
            if (useShadows) {
                ctx.shadowBlur = 15;
                ctx.shadowColor = this.color;
            }
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            if (useShadows) ctx.shadowBlur = 0;
        } else if (this.type === 'drip') {
            ctx.fillRect(this.x, this.y, 1, 4);
        } else if (this.type === 'dust') {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Draw Heart
            ctx.beginPath();
            const topY = this.y - 5;
            ctx.moveTo(this.x, topY + 5);
            ctx.bezierCurveTo(this.x - 5, topY - 5, this.x - 10, topY + 5, this.x, topY + 15);
            ctx.bezierCurveTo(this.x + 10, topY + 5, this.x + 5, topY - 5, this.x, topY + 5);
            ctx.fill();
        }

        ctx.restore();
    }
}

class Firefly {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = Math.random() * 3 + 2;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = 0.5 + Math.random() * 0.5;
        this.offset = Math.random() * 1000;
        this.color = '#ff69b4'; // Hot Pink
    }

    update(targetX, targetY) {
        const dx = targetX - this.x;
        const dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        this.x += (dx / dist) * this.speed;
        this.y += (dy / dist) * this.speed;
        this.x += Math.sin((Date.now() + this.offset) * 0.002) * 0.5;
        this.y += Math.cos((Date.now() + this.offset) * 0.003) * 0.5;
    }

    draw() {
        ctx.save();
        // Light should NEVER go out, high flicker floor
        const flicker = 0.7 + Math.sin((Date.now() + this.offset) * 0.005) * 0.3;
        ctx.globalAlpha = flicker;


        if (useShadows) {
            // --- OUTER GLOW (Aura) ---
            const auraSize = this.size * 10;
            const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, auraSize);
            grad.addColorStop(0, 'rgba(255, 105, 180, 0.4)'); // Pink core aura
            grad.addColorStop(1, 'rgba(255, 105, 180, 0)');   // Fade out
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(this.x, this.y, auraSize, 0, Math.PI * 2);
            ctx.fill();
        }

        // --- INNER BODY ---
        ctx.fillStyle = this.color;
        if (useShadows) {
            ctx.shadowBlur = this.size * 6; // Intensity scaled with size
            ctx.shadowColor = this.color;
        }
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        if (useShadows) ctx.shadowBlur = 0;

        ctx.restore();
    }
}



class Snow {
    constructor() {
        this.reset();
    }

    reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * -canvas.height;
        this.size = Math.random() * 3 + 1;
        this.speed = Math.random() * 2 + 1.0; // 2x hızlandırıldı (Eski: 1 + 0.5)
        this.wind = Math.random() * 0.5 - 0.25;
    }

    update() {
        this.y += this.speed;
        this.x += this.wind;

        // Stars move too
        if (this.isStar) {
            this.x += 0.2; // Constant drift
            if (this.x > canvas.width) this.x = 0;
        }

        if (this.y > (canvas.height || 600)) this.y = 0;
        if (this.x > (canvas.width || 800)) this.x = 0;
        if (this.x < 0) this.x = (canvas.width || 800);
    }

    draw() {
        ctx.fillStyle = COLOR_SNOW;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawBackground() {
    if (cachedBackground) {
        ctx.drawImage(cachedBackground, 0, 0);
        return;
    }

    cachedBackground = document.createElement('canvas');
    cachedBackground.width = canvas.width;
    cachedBackground.height = canvas.height;
    const bCtx = cachedBackground.getContext('2d');

    // Check if we are in the Well Level
    if (levels[currentLevel].isVertical) {
        drawWellBackground(bCtx);
        ctx.drawImage(cachedBackground, 0, 0);
        return;
    }

    // SKY
    const skyGrad = bCtx.createLinearGradient(0, 0, 0, cachedBackground.height);
    skyGrad.addColorStop(0, '#0f0c29');
    skyGrad.addColorStop(1, '#302b63');
    bCtx.fillStyle = skyGrad;
    bCtx.fillRect(0, 0, cachedBackground.width, cachedBackground.height);


    // STARS (Behind mountains)
    bCtx.fillStyle = '#ffffff';
    stars.forEach(s => {
        bCtx.globalAlpha = s.opacity;
        bCtx.beginPath();
        bCtx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
        bCtx.fill();
    });
    bCtx.globalAlpha = 1.0;

    // MOON
    drawHalfMoon(moon.x, moon.y, bCtx);

    // CLOUDS
    bCtx.fillStyle = '#ffffff';
    clouds.forEach(c => {
        bCtx.globalAlpha = c.opacity;
        drawCloud(c.x, c.y, c.w, c.h, bCtx);
    });
    bCtx.globalAlpha = 1.0;


    // MOUNTAINS
    bCtx.fillStyle = COLOR_MOUNTAIN;
    bCtx.beginPath();
    bCtx.moveTo(0, cachedBackground.height);
    bCtx.lineTo(cachedBackground.width * 0.2, cachedBackground.height * 0.6);
    bCtx.lineTo(cachedBackground.width * 0.4, cachedBackground.height * 0.8);
    bCtx.lineTo(cachedBackground.width * 0.6, cachedBackground.height * 0.5);
    bCtx.lineTo(cachedBackground.width * 0.8, cachedBackground.height * 0.7);
    bCtx.lineTo(cachedBackground.width, cachedBackground.height);
    bCtx.fill();

    // Snow caps
    bCtx.fillStyle = '#ffffff';
    bCtx.beginPath();
    bCtx.moveTo(cachedBackground.width * 0.15, cachedBackground.height * 0.7);
    bCtx.lineTo(cachedBackground.width * 0.2, cachedBackground.height * 0.6);
    bCtx.lineTo(cachedBackground.width * 0.25, cachedBackground.height * 0.7);
    bCtx.fill();

    bCtx.beginPath();
    bCtx.moveTo(cachedBackground.width * 0.55, cachedBackground.height * 0.6);
    bCtx.lineTo(cachedBackground.width * 0.6, cachedBackground.height * 0.5);
    bCtx.lineTo(cachedBackground.width * 0.65, cachedBackground.height * 0.6);
    bCtx.fill();

    // LAKE (Bottom of the screen)
    const lakeHeight = cachedBackground.height * 0.07;
    const lakeGrad = bCtx.createLinearGradient(0, cachedBackground.height - lakeHeight, 0, cachedBackground.height);
    lakeGrad.addColorStop(0, 'rgba(0, 150, 255, 0.4)');
    lakeGrad.addColorStop(1, 'rgba(0, 50, 150, 0.8)');
    bCtx.fillStyle = lakeGrad;
    bCtx.fillRect(0, cachedBackground.height - lakeHeight, cachedBackground.width, lakeHeight);

    ctx.drawImage(cachedBackground, 0, 0);
}

// --- LEVEL DATA ---
// Coordinates are percentage based (0.0 to 1.0) of canvas size to make it responsive-ish
const levels = [
    // LEVEL 1: Snowy Mountain Redesign
    {
        start: { x: 0.1, y: 0.8 },
        platforms: [
            { x: 0.0, y: 0.9, w: 0.3, h: 0.1, t: 'normal' }, // Start (Enemy removed)
            { x: 0.35, y: 0.8, w: 0.2, h: 0.05, t: 'normal', enemy: true },
            { x: 0.6, y: 0.7, w: 0.2, h: 0.05, t: 'normal', enemy: true },
            { x: 0.85, y: 0.6, w: 0.15, h: 0.05, t: 'normal', enemy: true },
            { x: 0.6, y: 0.45, w: 0.2, h: 0.05, t: 'normal', enemy: true },
            { x: 0.3, y: 0.35, w: 0.2, h: 0.05, t: 'normal', enemy: true },
            { x: 0.05, y: 0.25, w: 0.2, h: 0.05, t: 'normal', enemy: true },
            { x: 0.3, y: 0.15, w: 0.1, h: 0.05, t: 'goal' } // Goal (Enemy removed)
        ]
    },
    // LEVEL 2: Gaps, Spikes and Heart Traps (Extended)
    {
        start: { x: 0.05, y: 0.8 },
        platforms: [
            { x: 0.0, y: 0.9, w: 0.2, h: 0.1, t: 'normal' }, // Start
            { x: 0.25, y: 0.75, w: 0.15, h: 0.05, t: 'normal', enemy: true },
            { x: 0.45, y: 0.85, w: 0.1, h: 0.05, t: 'hazard' }, // Heart Trap 1
            { x: 0.6, y: 0.75, w: 0.15, h: 0.05, t: 'normal', enemy: true },
            { x: 0.8, y: 0.65, w: 0.1, h: 0.05, t: 'hazard' }, // Heart Trap 2
            { x: 0.6, y: 0.5, w: 0.15, h: 0.05, t: 'normal', enemy: true },
            { x: 0.4, y: 0.4, w: 0.15, h: 0.05, t: 'normal', enemy: true },
            { x: 0.2, y: 0.5, w: 0.1, h: 0.05, t: 'hazard' }, // Heart Trap 3
            { x: 0.05, y: 0.4, w: 0.15, h: 0.05, t: 'normal', enemy: true },
            { x: 0.2, y: 0.25, w: 0.15, h: 0.05, t: 'normal', enemy: true },
            // Removed Trap 4 to limit hazards to 3
            { x: 0.45, y: 0.2, w: 0.1, h: 0.05, t: 'normal', enemy: true },
            { x: 0.6, y: 0.3, w: 0.2, h: 0.05, t: 'normal', enemy: true },
            { x: 0.85, y: 0.2, w: 0.1, h: 0.05, t: 'goal' } // Goal
        ]
    },
    // LEVEL 3: The Summit (Redesigned)
    {
        start: { x: 0.1, y: 0.9 },
        platforms: [
            { x: 0.0, y: 0.95, w: 0.3, h: 0.05, t: 'normal' }, // Start Base
            { x: 0.4, y: 0.85, w: 0.2, h: 0.05, t: 'normal', enemy: true }, // First step up
            { x: 0.7, y: 0.75, w: 0.25, h: 0.05, t: 'normal', enemy: true }, // Right side
            { x: 0.45, y: 0.65, w: 0.15, h: 0.05, t: 'hazard' }, // Center Hazard
            { x: 0.1, y: 0.55, w: 0.25, h: 0.05, t: 'normal', enemy: true }, // Left side climb
            { x: 0.4, y: 0.45, w: 0.1, h: 0.05, t: 'normal' }, // Small center rest
            { x: 0.6, y: 0.35, w: 0.25, h: 0.05, t: 'normal', enemy: true }, // Upper right
            { x: 0.3, y: 0.25, w: 0.2, h: 0.05, t: 'normal', enemy: true }, // Final approach
            { x: 0.45, y: 0.15, w: 0.1, h: 0.05, t: 'goal' } // The Summit Goal
        ]
    },
    // LEVEL 4: Dark Well Escape
    {
        start: { x: 0.5, y: 0.9 },
        isVertical: true,
        platforms: [
            { x: 0.3, y: 0.95, w: 0.4, h: 0.05, t: 'normal' }, // Start Base
            { x: 0.1, y: 0.8, w: 0.2, h: 0.05, t: 'normal', enemy: true },
            { x: 0.6, y: 0.7, w: 0.2, h: 0.05, t: 'normal', enemy: true },
            { x: 0.3, y: 0.55, w: 0.2, h: 0.05, t: 'normal' },
            { x: 0.05, y: 0.4, w: 0.15, h: 0.05, t: 'hazard' },
            { x: 0.7, y: 0.3, w: 0.2, h: 0.05, t: 'normal', enemy: true },
            { x: 0.4, y: 0.15, w: 0.2, h: 0.05, t: 'normal' },
            // Above Screen (Vertical ascent continues)
            { x: 0.1, y: -0.05, w: 0.2, h: 0.05, t: 'normal', enemy: true },
            { x: 0.6, y: -0.2, w: 0.2, h: 0.05, t: 'normal' },
            { x: 0.3, y: -0.4, w: 0.2, h: 0.05, t: 'normal', enemy: true },
            { x: 0.7, y: -0.6, w: 0.15, h: 0.05, t: 'hazard' },
            { x: 0.15, y: -0.8, w: 0.1, h: 0.05, t: 'normal' },
            { x: 0.4, y: -1.0, w: 0.3, h: 0.05, t: 'normal', enemy: true },
            { x: 0.8, y: -1.2, w: 0.1, h: 0.05, t: 'normal' },
            { x: 0.45, y: -1.5, w: 0.1, h: 0.05, t: 'goal' } // The light at the end
        ]
    }
];

// --- GAME LOGIC ---

let player;
let platforms = [];
let enemies = [];
let bullets = [];
let particles = [];
let snowflakes = [];
let stars = [];
let clouds = [];
let moon = { x: 100, y: 100 };
let fireflies = [];
let currentTargetPlatformIndex = 0;


function initClouds() {
    clouds = [];
    for (let i = 0; i < 5; i++) {
        clouds.push({
            x: Math.random() * 2000,
            y: 50 + Math.random() * 150,
            w: 100 + Math.random() * 100,
            h: 30 + Math.random() * 30,
            opacity: 0.2 + Math.random() * 0.2
        });
    }
}

function initSnow() {
    snowflakes = [];
    const count = isMobile ? 50 : 150;
    for (let i = 0; i < count; i++) snowflakes.push(new Snow());
}

function initStars() {
    stars = [];
    const count = isMobile ? 80 : 200;
    for (let i = 0; i < count; i++) {
        stars.push({
            x: Math.random() * 2000,
            y: Math.random() * 600,
            size: Math.random() * 2,
            opacity: Math.random()
        });
    }
}

function resizeCanvas() {
    const container = document.getElementById('game-container');
    const width = container.offsetWidth;
    const height = container.offsetHeight;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';

    ctx.scale(dpr, dpr);

    cachedBackground = null;
    cachedPlatforms = null;

    if (currentState === 'PLAYING') loadLevel(currentLevel); // Reload to adjust positions
}

window.addEventListener('resize', resizeCanvas);

function loadLevel(levelIndex) {
    cachedBackground = null;
    cachedPlatforms = null;

    if (levelIndex >= levels.length) {
        gameWin();
        return;
    }

    currentLevel = levelIndex;
    const levelData = levels[levelIndex];
    document.getElementById('level-display').innerText = levelIndex + 1;

    // Create Player
    player = new Player(
        levelData.start.x * canvas.width,
        levelData.start.y * canvas.height
    );

    // Create Platforms & Enemies
    enemies = [];
    bullets = [];
    playerBullets = [];
    platforms = levelData.platforms.map(p => {
        const platform = new Platform(
            p.x * canvas.width,
            p.y * canvas.height,
            p.w * canvas.width,
            p.h * canvas.height,
            p.t
        );
        if (p.enemy) {
            enemies.push(new Enemy(platform));
        }
        return platform;
    });

    ammo = enemies.length * 2;
    const ammoDisplay = document.getElementById('ammo-display');
    if (ammoDisplay) ammoDisplay.innerText = ammo;

    // Initialize fireflies for Level 4
    fireflies = [];
    currentTargetPlatformIndex = 0;
    if (levels[currentLevel].isVertical) {
        for (let i = 0; i < 12; i++) {
            fireflies.push(new Firefly(player.x, player.y));
        }
    }
}
function checkCollision(r1, r2) {
    return (
        r1.x < r2.x + r2.width &&
        r1.x + r1.width > r2.x &&
        r1.y < r2.y + r2.height &&
        r1.y + r1.height > r2.y
    );
}

function spawnAmbientParticles() {
    // Constant stream of hearts
    const color = player.isGrounded ? '#ff0000' : (Math.random() > 0.5 ? '#9400d3' : '#ff7f00');
    particles.push(new Particle(
        player.x + Math.random() * player.width,
        player.y + player.height * 0.5, // Spawn near center/back
        color
    ));
}

function spawnContactParticles() {
    // Keep this for extra burst on landing? User said "always burn", 
    // but maybe a small burst on landing is still good. 
    // Let's call it on landing transitions if needed.
}

function resolveCollisions() {
    player.isGrounded = false;

    // Check platform collisions
    for (let p of platforms) {
        if (checkCollision(player, p)) {
            if (p.type === 'hazard') {
                restartLevel();
                return;
            }

            const prevY = player.y - player.velY;

            // Landing on top
            if (prevY + player.height <= p.y) {
                if (p.type === 'goal') {
                    nextLevel();
                    return;
                }
                player.isGrounded = true;
                player.jumpsLeft = 2; // Zıplama hakkını yenile
                player.velY = 0;
                player.y = p.y - player.height;

                // Update firefly target if player climbed higher
                const platformIndex = platforms.indexOf(p);
                if (platformIndex > currentTargetPlatformIndex) {
                    currentTargetPlatformIndex = platformIndex;
                }
            }
            // Hitting from bottom
            else if (prevY >= p.y + p.height) {
                player.velY = 0;
                player.y = p.y + p.height;
            }
            // Hitting side
            else {
                player.velX = 0;
                // If moving right
                if (player.x < p.x) player.x = p.x - player.width;
                // If moving left
                else player.x = p.x + p.width + 0.1; // push out
            }

            // Spawn particles if touching platform
            spawnContactParticles();
        }
    }

    // Camera follow (Horizontal is standard, Vertical for Level 4)
    if (levels[currentLevel].isVertical) {
        // Smoothly follow player vertically, keep player slightly below center
        const targetCameraY = player.y - canvas.height * 0.7;
        cameraY += (targetCameraY - cameraY) * 0.1;
    } else {
        cameraY = 0;
    }

    // Check enemy collisions
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        e.update();
        if (checkCollision(player, e)) {
            // Check if jumping on head
            const prevPlayerBottom = (player.y - player.velY) + player.height;
            if (player.velY > 0 && prevPlayerBottom <= e.y + 10) {
                // Kill enemy
                particles.push(new Particle(e.x + e.width / 2, e.y + e.height / 2, '#ffffff', 'spirit'));
                enemies.splice(i, 1);
                player.velY = -10; // Bounce back
                player.jumpsLeft = 2; // Restore jumps
            } else {
                restartLevel();
                return;
            }
        }
    }

    // Check player bullet collisions
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const pb = playerBullets[i];
        pb.update();

        // Hit enemies
        for (let j = enemies.length - 1; j >= 0; j--) {
            if (checkCollision(pb, enemies[j])) {
                particles.push(new Particle(enemies[j].x + enemies[j].width / 2, enemies[j].y + enemies[j].height / 2, '#ffffff', 'spirit'));
                enemies.splice(j, 1);
                playerBullets.splice(i, 1);
                break;
            }
        }

        if (!playerBullets[i]) continue;

        // Remove off-screen
        if (pb.x < 0 || pb.x > canvas.width) {
            playerBullets.splice(i, 1);
        }
    }

    // Check enemy bullet collisions
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.update();
        if (checkCollision(player, b)) {
            restartLevel();
            return;
        }
        // Remove off-screen bullets
        if (b.x < 0 || b.x > canvas.width) {
            bullets.splice(i, 1);
        }
    }

    // Fall off screen
    if (player.y > canvas.height) {
        restartLevel();
    }
}

function nextLevel() {
    currentLevel++;
    if (currentLevel < levels.length) {
        showMessage(`LEVEL ${currentLevel} COMPLETED`, "Sonraki Seviye");
        loadLevel(currentLevel);
    } else {
        gameWin();
    }
}

function restartLevel() {
    showMessage("HATA!", "Tekrar Dene");
    loadLevel(currentLevel);
}

function gameWin() {
    currentState = 'WIN';
    finaleTimer = 0;
    // Hide HUD
    const hud = ['level-display', 'ammo-display'];
    hud.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.parentElement.style.opacity = '0';
    });
}

function showMessage(title, sub) {
    const msg = document.getElementById('message-overlay');
    document.getElementById('message-title').innerText = title;
    document.getElementById('message-subtitle').innerText = sub;
    msg.classList.remove('hidden');
    currentState = 'PAUSED';
}

function hideMessage() {
    document.getElementById('message-overlay').classList.add('hidden');
    currentState = 'PLAYING';
    finaleTimer = 0;
    // If we just finished the game, reset to level 0
    if (currentLevel >= levels.length) {
        currentLevel = 0;
        loadLevel(0);
    }
}

// --- LOOP ---
function gameLoop() {
    if (currentState === 'PLAYING') {
        ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear

        drawBackground();

        // Snow
        snowflakes.forEach(s => {
            s.update();
            s.draw();
        });

        // Particles (Hearts & Spirits)
        // Moved into translated block below for correct positioning in Level 4


        player.update();
        resolveCollisions();

        // Environmental Particles for Level 4
        if (levels[currentLevel].isVertical) {
            if (Math.random() < 0.1) particles.push(new Particle(Math.random() * canvas.width, cameraY, 'rgba(200,200,255,0.5)', 'drip'));
            if (Math.random() < 0.05) particles.push(new Particle(Math.random() * canvas.width, cameraY + Math.random() * canvas.height, 'rgba(255,255,255,0.3)', 'dust'));
        }

        ctx.save();
        ctx.translate(0, -cameraY);

        // Update and draw particles in world space
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].draw();
            if (particles[i].life <= 0) particles.splice(i, 1);
        }

        if (cachedPlatforms) {
            ctx.drawImage(cachedPlatforms, 0, -cameraY);
        } else {
            cachedPlatforms = document.createElement('canvas');
            cachedPlatforms.width = canvas.width;
            cachedPlatforms.height = canvas.height * (levels[currentLevel].isVertical ? 5 : 1); // Extra height for vertical levels
            const pCtx = cachedPlatforms.getContext('2d');
            pCtx.scale(dpr, dpr);

            // Temporarily swap ctx to draw platforms to cache
            const mainCtx = ctx;
            ctx = pCtx;
            platforms.forEach(p => p.draw());
            ctx = mainCtx;

            ctx.drawImage(cachedPlatforms, 0, -cameraY);
        }

        enemies.forEach(e => e.draw());
        player.draw();
        ctx.restore();


        // Spawn ambient particles
        spawnAmbientParticles();

        // Darkness / Spotlight effect for Level 4
        if (levels[currentLevel].isVertical) {
            drawDarkness();
        }

        // Update and draw fireflies (After darkness to pierce it)
        if (fireflies.length > 0) {
            const nextP = platforms[currentTargetPlatformIndex + 1] || platforms[currentTargetPlatformIndex];
            const tx = nextP.x + nextP.width / 2;
            const ty = nextP.y - 10;

            ctx.save();
            ctx.translate(0, -cameraY);
            fireflies.forEach(f => {
                f.update(tx, ty);
                f.draw();
            });
            ctx.restore();
        }

        // Update and draw bullets (After darkness to pierce it)
        if (bullets.length > 0 || playerBullets.length > 0) {
            ctx.save();
            ctx.translate(0, -cameraY);
            bullets.forEach(b => b.draw());
            playerBullets.forEach(pb => pb.draw());
            ctx.restore();
        }
    } else if (currentState === 'WIN') {


        drawFinale();
    }
    requestAnimationFrame(gameLoop);
}

function drawDarkness() {
    ctx.save();
    // Use second canvas or offscreen buffer ideally, but for now:
    const grad = ctx.createRadialGradient(
        player.x + player.width / 2,
        player.y + player.height / 2 - cameraY,
        5, // Tightened inner radius
        player.x + player.width / 2,
        player.y + player.height / 2 - cameraY,
        spotlightRadius - 20 // Slightly smaller spotlight
    );
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.98)'); // Darker outer

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Vignette
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 100;
    ctx.strokeRect(0, 0, canvas.width, canvas.height);
    ctx.restore();
}

function drawFinale() {
    finaleTimer++;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Smooth white-out transition at start
    const bloom = Math.max(0, 1 - finaleTimer / 60);

    // Golden Forest Sky
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, '#a8e063'); // Soft Green
    sky.addColorStop(1, '#fbd72b'); // Golden Yellow
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Sun Rays
    ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
    for (let i = 0; i < 12; i++) {
        ctx.beginPath();
        const angle = i * 0.15 + (Date.now() * 0.00005);
        ctx.moveTo(canvas.width * 0.8, 0); // Sun at top right
        ctx.lineTo(canvas.width * 0.8 - Math.cos(angle) * 1500, Math.sin(angle) * 1500);
        ctx.lineTo(canvas.width * 0.8 - Math.cos(angle + 0.05) * 1500, Math.sin(angle + 0.05) * 1500);
        ctx.fill();
    }

    // Forest Silhouettes
    ctx.fillStyle = 'rgba(27, 77, 62, 0.3)';
    for (let i = 0; i < 5; i++) {
        const tx = (i * 250 + (Date.now() * 0.01)) % (canvas.width + 400) - 200;
        ctx.fillRect(tx, canvas.height - 200, 100, 200);
    }

    // Ground
    ctx.fillStyle = '#1b4d3e';
    ctx.fillRect(0, canvas.height - 50, canvas.width, 50);

    ctx.fillStyle = '#ffffff';
    if (useShadows) {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#000000';
    }
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';

    if (finaleTimer > 100) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (finaleTimer - 100) / 60);
        ctx.fillText("THANK YOU FOR PLAYING", canvas.width / 2, canvas.height / 2);
        ctx.restore();
    }

    if (finaleTimer > 300) {
        ctx.save();
        ctx.globalAlpha = Math.min(1, (finaleTimer - 300) / 60);
        ctx.font = '20px Arial';
        ctx.fillText("Press N to Restart", canvas.width / 2, canvas.height / 2 + 50);
        ctx.restore();
    }

    // Draw Character walking
    player.x = (canvas.width * 0.2 + finaleTimer * 0.5) % (canvas.width + 100);
    player.y = canvas.height - 80;
    player.draw();

    // Initial Bloom
    // Initial Bloom
    if (bloom > 0) {
        ctx.fillStyle = `rgba(255,255,255,${bloom})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (useShadows) ctx.shadowBlur = 0;
}

// --- INIT ---
initSnow();
initStars();
initClouds();
resizeCanvas(); // Set size and load level 0
gameLoop();

// --- INPUTS ---
window.addEventListener('keydown', (e) => {
    switch (e.code) {
        case 'ArrowLeft': case 'KeyA': keys.left = true; break;
        case 'ArrowRight': case 'KeyD': keys.right = true; break;
        case 'ArrowUp': case 'KeyW': case 'Space':
            keys.up = true;
            player.jump();
            break;
        case 'KeyE': case 'Enter':
            keys.shoot = true;
            player.shoot();
            break;
        case 'KeyN':
            if (currentState === 'WIN') {
                // Show HUD again
                const hud = ['level-display', 'ammo-display'];
                hud.forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.parentElement.style.opacity = '1';
                });
                currentLevel = 0;
                loadLevel(0);
                currentState = 'PLAYING';
            } else {
                nextLevel();
            }
            break;
    }
});

window.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'ArrowLeft': case 'KeyA': keys.left = false; break;
        case 'ArrowRight': case 'KeyD': keys.right = false; break;
        case 'ArrowUp': case 'KeyW': case 'Space': keys.up = false; break;
    }
});

// Touch Controls
const btnLeft = document.getElementById('btn-left');
const btnRight = document.getElementById('btn-right');
const btnJump = document.getElementById('btn-jump');
const btnShoot = document.getElementById('btn-shoot');

const addTouch = (elem, key) => {
    elem.addEventListener('touchstart', (e) => { e.preventDefault(); keys[key] = true; if (key === 'up') player.jump(); if (key === 'shoot') player.shoot(); });
    elem.addEventListener('touchend', (e) => { e.preventDefault(); keys[key] = false; });
    // Mouse fallback for testing
    elem.addEventListener('mousedown', (e) => { e.preventDefault(); keys[key] = true; if (key === 'up') player.jump(); if (key === 'shoot') player.shoot(); });
    elem.addEventListener('mouseup', (e) => { e.preventDefault(); keys[key] = false; });
};

addTouch(btnLeft, 'left');
addTouch(btnRight, 'right');
addTouch(btnJump, 'up');
if (btnShoot) addTouch(btnShoot, 'shoot');

// Message Click to Resume
document.getElementById('message-overlay').addEventListener('click', hideMessage);
document.getElementById('message-overlay').addEventListener('touchstart', hideMessage);

function drawHalfMoon(x, y, targetCtx = ctx) {
    targetCtx.save();
    targetCtx.fillStyle = '#fdfdfd';
    if (useShadows) {
        targetCtx.shadowBlur = 20;
        targetCtx.shadowColor = 'rgba(255,255,255,0.5)';
    }
    targetCtx.beginPath();
    targetCtx.arc(x, y, 30, Math.PI * 0.5, Math.PI * 1.5); // Crescent base
    targetCtx.fill();

    // Mask to make it a crescent/half-moon
    targetCtx.globalCompositeOperation = 'destination-out';
    targetCtx.beginPath();
    targetCtx.arc(x + 10, y, 30, 0, Math.PI * 2);
    targetCtx.fill();
    targetCtx.restore();
}

function drawWellBackground(targetCtx = ctx) {
    // Deep dark background
    targetCtx.fillStyle = '#0a0a0c';
    targetCtx.fillRect(0, 0, canvas.width, canvas.height);

    // Stone Walls (Left and Right)
    const wallWidth = 60;
    targetCtx.fillStyle = '#1a1a1c';

    // Draw left wall
    targetCtx.fillRect(0, 0, wallWidth, canvas.height);
    // Draw right wall
    targetCtx.fillRect(canvas.width - wallWidth, 0, wallWidth, canvas.height);

    // Stone Textures (Static for cache)
    targetCtx.fillStyle = '#252527';
    for (let y = 0; y < canvas.height; y += 120) {
        // Left wall stones
        targetCtx.fillRect(10, y + 10, 40, 30);
        targetCtx.fillRect(0, y + 60, 30, 40);

        // Right wall stones
        targetCtx.fillRect(canvas.width - 50, y + 20, 40, 30);
        targetCtx.fillRect(canvas.width - 30, y + 70, 30, 40);
    }
}

function drawCloud(x, y, w, h, targetCtx = ctx) {
    targetCtx.beginPath();
    targetCtx.rect(x, y, w, h);
    // Draw circles for puffy look
    targetCtx.arc(x, y + h, h, 0, Math.PI * 2);
    targetCtx.arc(x + w * 0.5, y + h * 0.5, h * 1.2, 0, Math.PI * 2);
    targetCtx.arc(x + w, y + h, h, 0, Math.PI * 2);
    targetCtx.fill();
}



