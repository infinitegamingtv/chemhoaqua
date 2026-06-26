// Fruit Slasher: Blade Master Game Logic

// --- Global Settings and Constants ---
const GRAVITY = 0.28;
const BASE_FRUIT_RADIUS = 36;
const BOMB_RADIUS = 32;
const MAX_SWIPE_POINTS = 15;
const SWIPE_POINT_LIFETIME = 150; // ms

// Fruit Types with visual parameters
const FRUIT_TYPES = {
    WATERMELON: {
        name: 'Dưa hấu',
        radius: 46,
        color: '#ff3b30',
        juiceColor: '#ff2d55',
        points: 1
    },
    APPLE: {
        name: 'Táo',
        radius: 34,
        color: '#ff3b30',
        juiceColor: '#ff6b6b',
        points: 1
    },
    COCONUT: {
        name: 'Dừa',
        radius: 38,
        color: '#fff',
        juiceColor: '#f2f2f2',
        points: 2
    },
    ORANGE: {
        name: 'Cam',
        radius: 36,
        color: '#ff9500',
        juiceColor: '#ffcc00',
        points: 1
    },
    BANANA: {
        name: 'Chuối',
        radius: 35,
        color: '#ffcc00',
        juiceColor: '#ffe680',
        points: 1
    },
    PINEAPPLE: {
        name: 'Dứa',
        radius: 42,
        color: '#ffe600',
        juiceColor: '#fff59d',
        points: 2
    }
};

// Arcade Special Bananas
const ARCADE_POWERUPS = {
    FRENZY: {
        name: 'Chuối Cuồng Nhiệt',
        color: '#ff5e00',
        glowColor: '#ff3b30',
        type: 'frenzy',
        duration: 5000 // ms
    },
    FREEZE: {
        name: 'Chuối Băng Giá',
        color: '#5ac8fa',
        glowColor: '#007aff',
        type: 'freeze',
        duration: 5000
    },
    DOUBLE: {
        name: 'Chuối Nhân Đôi',
        color: '#af52de',
        glowColor: '#ff2d55',
        type: 'double',
        duration: 6000
    }
};

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // State variables
        this.gameState = 'MENU'; // MENU, PLAYING, PAUSED, GAMEOVER, LEADERBOARD
        this.gameMode = 'CLASSIC'; // CLASSIC, ZEN, ARCADE
        
        this.score = 0;
        this.lives = 3;
        this.timeRemaining = 0;
        this.lastTime = 0;
        this.spawnTimer = 0;
        this.spawnInterval = 1200; // ms between spawns
        
        // Multiplayer State
        this.isMultiplayer = false;
        this.opponentScore = 0;
        this.fruitIdCounter = 0;
        this.lastSyncedTime = 0;
        
        this.fruits = [];
        this.particles = [];
        this.backgroundSplats = [];
        this.swipePoints = [];
        this.isSlicing = false;
        
        // Screen Shake
        this.shakeTime = 0;
        this.shakeIntensity = 0;
        
        // Active Powerups in Arcade
        this.activePowerups = {
            frenzy: 0, // end timestamp
            freeze: 0,
            double: 0
        };
        
        // Stats
        this.slicedCount = 0;
        this.comboCounter = 0;
        this.maxCombo = 0;
        this.comboResetTimer = null;
        this.swipeSliceQueue = []; // Track sliced fruits in the current swipe
        
        // Window responsiveness
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        // Event Listeners
        this.setupInputListeners();
        this.setupUIListeners();
        
        // Initial setup
        this.loadAudioSetting();
        this.renderLeaderboard('classic');
        
        window.gameInstance = this;
        
        // Start animation loop
        requestAnimationFrame((t) => this.loop(t));
    }
    
    resizeCanvas() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = window.innerWidth * dpr;
        this.canvas.height = window.innerHeight * dpr;
        this.ctx.scale(dpr, dpr);
        this.width = window.innerWidth;
        this.height = window.innerHeight;
    }
    
    // --- State Management ---
    
    startMultiplayerGame() {
        this.isMultiplayer = true;
        this.opponentScore = 0;
        this.fruitIdCounter = 0;
        this.lastSyncedTime = 0;
        
        // Hide single score, show multiplayer scoreboard list
        document.getElementById('single-score-box').classList.add('hidden');
        document.getElementById('multi-score-box').classList.remove('hidden');
        
        // Update list of players initially
        this.updateMultiplayerScoreboardHUD();
        
        // Start Zen Mode (90 seconds score race)
        this.startGame('ZEN');
    }
    
    startGame(mode) {
        window.gameAudio.resume();
        window.gameAudio.playClick();
        
        this.gameState = 'PLAYING';
        this.gameMode = mode;
        this.score = 0;
        this.slicedCount = 0;
        this.maxCombo = 0;
        this.fruits = [];
        this.particles = [];
        this.backgroundSplats = [];
        this.swipePoints = [];
        
        // Reset powerups
        this.activePowerups = { frenzy: 0, freeze: 0, double: 0 };
        this.updatePowerupHUD();
        
        // Show/hide UI overlays
        document.getElementById('menu-screen').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('pause-screen').classList.add('hidden');
        document.getElementById('leaderboard-screen').classList.add('hidden');
        document.getElementById('btn-gameplay-pause').classList.remove('hidden');
        
        // Setup modes details
        if (mode === 'CLASSIC') {
            this.lives = 3;
            document.getElementById('lives-container').classList.remove('hidden');
            document.getElementById('timer-container').classList.add('hidden');
            this.resetHearts();
            this.spawnInterval = 1400;
        } else if (mode === 'ZEN') {
            this.lives = 0;
            this.timeRemaining = this.isMultiplayer ? 15 : 90; // 15 seconds in multiplayer, 90 seconds in single-player
            document.getElementById('lives-container').classList.add('hidden');
            document.getElementById('timer-container').classList.remove('hidden');
            document.getElementById('timer-val').innerText = this.timeRemaining;
            this.spawnInterval = 1000;
        } else if (mode === 'ARCADE') {
            this.lives = 0;
            this.timeRemaining = 60; // 60 seconds
            document.getElementById('lives-container').classList.add('hidden');
            document.getElementById('timer-container').classList.remove('hidden');
            document.getElementById('timer-val').innerText = this.timeRemaining;
            this.spawnInterval = 850;
        }
        
        // In multiplayer, score updates are driven separately
        if (!this.isMultiplayer) {
            document.getElementById('single-score-box').classList.remove('hidden');
            document.getElementById('multi-score-box').classList.add('hidden');
            document.getElementById('score-val').innerText = '0';
        }
        
        // Start background music
        window.gameAudio.startBGM();
        
        this.lastTime = performance.now();
        this.spawnTimer = 0;
    }
    
    pauseGame() {
        if (this.gameState !== 'PLAYING') return;
        if (this.isMultiplayer && !window.gameMultiplayer.isHost) {
            alert('Chỉ chủ phòng (Host) mới có quyền tạm dừng!');
            return;
        }
        window.gameAudio.playClick();
        
        this.gameState = 'PAUSED';
        window.gameAudio.stopBGM();
        window.gameAudio.stopFuseSizzle();
        
        document.getElementById('pause-screen').classList.remove('hidden');
        document.getElementById('pause-screen').classList.add('active');
        document.getElementById('btn-gameplay-pause').classList.add('hidden');
        
        if (this.isMultiplayer && window.gameMultiplayer.isHost) {
            window.gameMultiplayer.broadcast({ type: 'pause' });
        }
    }
    
    syncPause() {
        this.gameState = 'PAUSED';
        window.gameAudio.stopBGM();
        window.gameAudio.stopFuseSizzle();
        document.getElementById('pause-screen').classList.remove('hidden');
        document.getElementById('pause-screen').classList.add('active');
        document.getElementById('btn-gameplay-pause').classList.add('hidden');
    }
    
    resumeGame() {
        if (this.gameState !== 'PAUSED') return;
        if (this.isMultiplayer && !window.gameMultiplayer.isHost) {
            alert('Chỉ chủ phòng (Host) mới có quyền tiếp tục!');
            return;
        }
        window.gameAudio.playClick();
        
        this.gameState = 'PLAYING';
        window.gameAudio.startBGM();
        
        // Check if there are active bombs, restart their sizzle sound
        const hasBomb = this.fruits.some(f => f.isBomb && !f.sliced);
        if (hasBomb) {
            window.gameAudio.startFuseSizzle();
        }
        
        document.getElementById('pause-screen').classList.add('hidden');
        document.getElementById('pause-screen').classList.remove('active');
        document.getElementById('btn-gameplay-pause').classList.remove('hidden');
        this.lastTime = performance.now();
        
        if (this.isMultiplayer && window.gameMultiplayer.isHost) {
            window.gameMultiplayer.broadcast({ type: 'resume' });
        }
    }
    
    syncResume() {
        this.gameState = 'PLAYING';
        window.gameAudio.startBGM();
        
        const hasBomb = this.fruits.some(f => f.isBomb && !f.sliced);
        if (hasBomb) {
            window.gameAudio.startFuseSizzle();
        }
        
        document.getElementById('pause-screen').classList.add('hidden');
        document.getElementById('pause-screen').classList.remove('active');
        document.getElementById('btn-gameplay-pause').classList.remove('hidden');
        this.lastTime = performance.now();
    }
    
    exitToMenu() {
        window.gameAudio.playClick();
        this.gameState = 'MENU';
        window.gameAudio.stopBGM();
        window.gameAudio.stopFuseSizzle();
        
        document.getElementById('pause-screen').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        document.getElementById('btn-gameplay-pause').classList.add('hidden');
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('menu-screen').classList.add('active');
        
        if (this.isMultiplayer) {
            if (window.gameMultiplayer.isHost) {
                window.gameMultiplayer.broadcast({ type: 'exit' });
            } else {
                window.gameMultiplayer.send({ type: 'exit' });
            }
            window.gameMultiplayer.cleanup();
            this.isMultiplayer = false;
        }
        
        // Restore single score HUD
        document.getElementById('single-score-box').classList.remove('hidden');
        document.getElementById('multi-score-box').classList.add('hidden');
    }
    
    gameOver() {
        this.gameState = 'GAMEOVER';
        window.gameAudio.stopBGM();
        window.gameAudio.stopFuseSizzle();
        window.gameAudio.playGameOverChime();
        
        document.getElementById('btn-gameplay-pause').classList.add('hidden');
        document.getElementById('game-over-screen').classList.remove('hidden');
        document.getElementById('game-over-screen').classList.add('active');
        
        const nameInputBox = document.getElementById('name-input-container');
        const newHighScoreBanner = document.getElementById('new-high-score-banner');
        
        const spStats = document.getElementById('sp-stats-box');
        const mpStats = document.getElementById('mp-rankings-box');
        
        if (this.isMultiplayer) {
            // Multiplayer Game Over
            document.getElementById('game-over-mode-title').innerText = 'ĐỐI KHÁNG MULTIPLAYER';
            
            spStats.classList.add('hidden');
            mpStats.classList.remove('hidden');
            nameInputBox.classList.add('hidden');
            newHighScoreBanner.classList.remove('hidden');
            
            // Sort players list descending
            const sorted = [...window.gameMultiplayer.players].sort((a, b) => b.score - a.score);
            
            // Compile rankings display
            const list = document.getElementById('mp-final-rankings-list');
            list.innerHTML = '';
            sorted.forEach((p, idx) => {
                const li = document.createElement('li');
                li.style.display = 'flex';
                li.style.justifyContent = 'space-between';
                li.style.alignItems = 'center';
                li.style.padding = '8px 12px';
                li.style.background = 'rgba(255,255,255,0.03)';
                li.style.borderRadius = '10px';
                li.style.border = `1px solid ${p.color}40`;
                li.style.color = p.color;
                li.style.fontWeight = '800';
                
                const isMe = p.id === window.gameMultiplayer.myPeerId;
                const displayName = isMe ? `${p.name} (BẠN)` : p.name;
                
                li.innerHTML = `
                    <div style="display:flex; align-items:center;">
                        <span style="width:24px; font-weight:900;">#${idx+1}</span>
                        <span>${displayName}</span>
                    </div>
                    <span>${p.score} đ</span>
                `;
                list.appendChild(li);
            });
            
            // Declare winner banner
            const isHost = window.gameMultiplayer.isHost;
            if (isHost) {
                if (sorted.length > 0) {
                    newHighScoreBanner.innerText = `★ CHIẾN THẮNG: ${sorted[0].name.toUpperCase()} ★`;
                    newHighScoreBanner.style.background = sorted[0].color;
                    newHighScoreBanner.style.color = '#fff';
                } else {
                    newHighScoreBanner.innerText = 'Trận đấu kết thúc!';
                }
                
                // Broadcast final scores to everyone
                window.gameMultiplayer.broadcast({
                    type: 'game-over',
                    players: window.gameMultiplayer.players
                });
            } else {
                // Client side displays their own ranking
                const myRankIdx = sorted.findIndex(p => p.id === window.gameMultiplayer.myPeerId);
                if (myRankIdx === 0) {
                    newHighScoreBanner.innerText = '★ CHIẾN THẮNG! BẠN VÔ ĐỊCH! ★';
                    newHighScoreBanner.style.background = 'linear-gradient(90deg, #4cd964, #5ac8fa)';
                    newHighScoreBanner.style.color = '#fff';
                } else {
                    newHighScoreBanner.innerText = `HẠNG #${myRankIdx + 1} / ${sorted.length}`;
                    newHighScoreBanner.style.background = 'linear-gradient(90deg, #ff9500, #ff2d55)';
                    newHighScoreBanner.style.color = '#fff';
                }
            }
        } else {
            // Single Player Game Over
            document.getElementById('game-over-mode-title').innerText = `CHẾ ĐỘ ${this.gameMode}`;
            spStats.classList.remove('hidden');
            mpStats.classList.add('hidden');
            
            document.getElementById('final-score').innerText = this.score;
            document.getElementById('max-combo').innerText = `${this.maxCombo}x`;
            document.getElementById('sliced-count').innerText = this.slicedCount;
            
            const isQualified = this.checkHighScoreEligibility(this.gameMode.toLowerCase(), this.score);
            if (isQualified && this.score > 0) {
                nameInputBox.classList.remove('hidden');
                newHighScoreBanner.classList.remove('hidden');
                newHighScoreBanner.innerText = '★ KỶ LỤC MỚI! ★';
                newHighScoreBanner.style.background = ''; // reset
                newHighScoreBanner.style.color = '';
                document.getElementById('player-name-input').value = localStorage.getItem('fruitSlasher_lastPlayer') || '';
            } else {
                nameInputBox.classList.add('hidden');
                newHighScoreBanner.classList.add('hidden');
            }
        }
    }
    
    syncMultiplayerGameOver(data) {
        // Client side game over syncer
        this.gameState = 'GAMEOVER';
        window.gameAudio.stopBGM();
        window.gameAudio.stopFuseSizzle();
        window.gameAudio.playGameOverChime();
        
        document.getElementById('btn-gameplay-pause').classList.add('hidden');
        document.getElementById('game-over-screen').classList.remove('hidden');
        document.getElementById('game-over-screen').classList.add('active');
        
        document.getElementById('game-over-mode-title').innerText = 'ĐỐI KHÁNG MULTIPLAYER';
        
        const spStats = document.getElementById('sp-stats-box');
        const mpStats = document.getElementById('mp-rankings-box');
        spStats.classList.add('hidden');
        mpStats.classList.remove('hidden');
        
        document.getElementById('name-input-container').classList.add('hidden');
        const banner = document.getElementById('new-high-score-banner');
        banner.classList.remove('hidden');
        
        // Sync players
        window.gameMultiplayer.players = data.players;
        
        const sorted = [...window.gameMultiplayer.players].sort((a, b) => b.score - a.score);
        
        // Compile rankings
        const list = document.getElementById('mp-final-rankings-list');
        list.innerHTML = '';
        sorted.forEach((p, idx) => {
            const li = document.createElement('li');
            li.style.display = 'flex';
            li.style.justifyContent = 'space-between';
            li.style.alignItems = 'center';
            li.style.padding = '8px 12px';
            li.style.background = 'rgba(255,255,255,0.03)';
            li.style.borderRadius = '10px';
            li.style.border = `1px solid ${p.color}40`;
            li.style.color = p.color;
            li.style.fontWeight = '800';
            
            const isMe = p.id === window.gameMultiplayer.myPeerId;
            const displayName = isMe ? `${p.name} (BẠN)` : p.name;
            
            li.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <span style="width:24px; font-weight:900;">#${idx+1}</span>
                    <span>${displayName}</span>
                </div>
                <span>${p.score} đ</span>
            `;
            list.appendChild(li);
        });
        
        // Show local rank
        const myRankIdx = sorted.findIndex(p => p.id === window.gameMultiplayer.myPeerId);
        if (myRankIdx === 0) {
            banner.innerText = '★ CHIẾN THẮNG! BẠN VÔ ĐỊCH! ★';
            banner.style.background = 'linear-gradient(90deg, #4cd964, #5ac8fa)';
            banner.style.color = '#fff';
        } else {
            banner.innerText = `HẠNG #${myRankIdx + 1} / ${sorted.length}`;
            banner.style.background = 'linear-gradient(90deg, #ff9500, #ff2d55)';
            banner.style.color = '#fff';
        }
    }
    
    // --- Heart Icons Control ---
    resetHearts() {
        const hearts = document.querySelectorAll('.heart');
        hearts.forEach(h => {
            h.classList.add('active');
            h.classList.remove('lost');
        });
    }
    
    loseLife() {
        if (this.gameMode !== 'CLASSIC' || this.gameState !== 'PLAYING') return;
        
        this.lives--;
        const hearts = document.querySelectorAll('.heart');
        const heartToLose = hearts[this.lives];
        if (heartToLose) {
            heartToLose.classList.remove('active');
            heartToLose.classList.add('lost');
        }
        
        this.triggerScreenShake(8, 250);
        
        if (this.lives <= 0) {
            this.gameOver();
        }
    }
    
    // --- Input Processing ---
    
    setupInputListeners() {
        const handleStart = (x, y) => {
            if (this.gameState !== 'PLAYING') return;
            if (this.isMultiplayer && window.gameMultiplayer.isHost) return; // HOST DOES NOT PLAY (SPECTATOR ONLY)
            this.isSlicing = true;
            this.swipePoints = [{ x, y, time: performance.now() }];
            this.swipeSliceQueue = [];
        };
        
        const handleMove = (x, y) => {
            if (!this.isSlicing || this.gameState !== 'PLAYING') return;
            
            const now = performance.now();
            this.swipePoints.push({ x, y, time: now });
            
            // Limit points array length
            if (this.swipePoints.length > MAX_SWIPE_POINTS) {
                this.swipePoints.shift();
            }
            
            // Swoosh Sound Effect on large moves
            if (this.swipePoints.length >= 3) {
                const p1 = this.swipePoints[this.swipePoints.length - 1];
                const p2 = this.swipePoints[this.swipePoints.length - 3];
                const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
                if (dist > 60) {
                    window.gameAudio.playSwoosh(dist / 40);
                }
            }
            
            if (this.isMultiplayer) {
                window.gameMultiplayer.sendSwipe(this.swipePoints);
            }
            
            // Check for cuts with active fruits
            this.checkCollisions();
        };
        
        const handleEnd = () => {
            this.isSlicing = false;
            // Evaluate combo if any
            this.evaluateCombo();
            this.swipePoints = [];
            
            if (this.isMultiplayer) {
                window.gameMultiplayer.sendSwipe([]);
            }
        };
        
        // Mouse Listeners
        this.canvas.addEventListener('mousedown', (e) => {
            e.preventDefault();
            handleStart(e.clientX, e.clientY);
        });
        
        window.addEventListener('mousemove', (e) => {
            handleMove(e.clientX, e.clientY);
        });
        
        window.addEventListener('mouseup', () => {
            handleEnd();
        });
        
        // Touch Listeners
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (e.touches.length > 0) {
                handleStart(e.touches[0].clientX, e.touches[0].clientY);
            }
        });
        
        window.addEventListener('touchmove', (e) => {
            if (e.touches.length > 0) {
                handleMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        });
        
        window.addEventListener('touchend', () => {
            handleEnd();
        });
    }
    
    setupUIListeners() {
        // Mode Buttons
        document.getElementById('btn-classic').addEventListener('click', () => this.startGame('CLASSIC'));
        document.getElementById('btn-zen').addEventListener('click', () => this.startGame('ZEN'));
        document.getElementById('btn-arcade').addEventListener('click', () => this.startGame('ARCADE'));
        
        // Multiplayer Trigger
        document.getElementById('btn-multiplayer').addEventListener('click', () => {
            window.gameMultiplayer.showScreen();
        });
        document.getElementById('btn-mp-create').addEventListener('click', () => {
            window.gameMultiplayer.createRoom();
        });
        document.getElementById('btn-mp-join').addEventListener('click', () => {
            window.gameMultiplayer.joinRoom();
        });
        document.getElementById('btn-mp-back').addEventListener('click', () => {
            window.gameMultiplayer.backToMenu();
        });
        
        // Gameplay pause trigger
        document.getElementById('btn-gameplay-pause').addEventListener('click', () => this.pauseGame());
        
        // Modal buttons
        document.getElementById('btn-resume').addEventListener('click', () => this.resumeGame());
        document.getElementById('btn-restart-pause').addEventListener('click', () => {
            if (this.isMultiplayer) {
                alert('Không thể chơi lại trực tiếp trong phòng chơi nhiều người!');
                return;
            }
            this.startGame(this.gameMode);
        });
        document.getElementById('btn-exit-pause').addEventListener('click', () => this.exitToMenu());
        
        // Retry/Menu
        document.getElementById('btn-retry').addEventListener('click', () => {
            if (this.isMultiplayer) {
                this.exitToMenu();
                return;
            }
            this.startGame(this.gameMode);
        });
        document.getElementById('btn-menu').addEventListener('click', () => this.exitToMenu());
        
        // Save score
        document.getElementById('btn-save-score').addEventListener('click', () => {
            const nameInput = document.getElementById('player-name-input');
            const name = nameInput.value.trim() || 'Vô Danh';
            localStorage.setItem('fruitSlasher_lastPlayer', name);
            this.saveHighScore(this.gameMode.toLowerCase(), name, this.score);
            document.getElementById('name-input-container').classList.add('hidden');
            document.getElementById('new-high-score-banner').classList.add('hidden');
            this.renderLeaderboard(this.gameMode.toLowerCase());
            this.showLeaderboard(this.gameMode.toLowerCase());
        });
        
        // Audio Toggle
        const audioBtn = document.getElementById('btn-audio-toggle');
        audioBtn.addEventListener('click', () => {
            const enabled = window.gameAudio.toggle();
            this.updateAudioUI(enabled);
            window.gameAudio.playClick();
        });
        
        // Leaderboard Modals
        document.getElementById('btn-leaderboard').addEventListener('click', () => {
            window.gameAudio.playClick();
            this.showLeaderboard('classic');
        });
        document.getElementById('btn-close-leaderboard').addEventListener('click', () => {
            window.gameAudio.playClick();
            document.getElementById('leaderboard-screen').classList.add('hidden');
        });
        
        // Tabs on Leaderboard
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                window.gameAudio.playClick();
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const mode = tab.dataset.tab;
                this.renderLeaderboard(mode);
            });
        });
        
        // Clear Leaderboard
        document.getElementById('btn-clear-scores').addEventListener('click', () => {
            if (confirm('Bạn có chắc chắn muốn xóa toàn bộ bảng xếp hạng?')) {
                window.gameAudio.playClick();
                localStorage.removeItem('fruitSlasher_scores_classic');
                localStorage.removeItem('fruitSlasher_scores_zen');
                localStorage.removeItem('fruitSlasher_scores_arcade');
                const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
                this.renderLeaderboard(activeTab);
            }
        });
    }
    
    loadAudioSetting() {
        const enabled = window.gameAudio.enabled;
        this.updateAudioUI(enabled);
    }
    
    updateAudioUI(enabled) {
        if (enabled) {
            document.getElementById('svg-sound-on').classList.remove('hidden');
            document.getElementById('svg-sound-off').classList.add('hidden');
        } else {
            document.getElementById('svg-sound-on').classList.add('hidden');
            document.getElementById('svg-sound-off').classList.remove('hidden');
        }
    }
    
    showLeaderboard(mode) {
        const board = document.getElementById('leaderboard-screen');
        board.classList.remove('hidden');
        board.classList.add('active');
        
        // Set active tab
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(t => {
            if (t.dataset.tab === mode) {
                t.classList.add('active');
            } else {
                t.classList.remove('active');
            }
        });
        this.renderLeaderboard(mode);
    }
    
    // --- Physics Engine & Spawning ---
    
    spawnFruitWave() {
        const now = performance.now();
        // Spawning adjustments based on Arcade freeze active
        const freezeActive = this.activePowerups.freeze > now;
        
        let count = 1;
        
        // Wave count logic
        if (this.gameMode === 'CLASSIC') {
            const progress = Math.min(this.score / 150, 1); // Max difficulty at score 150
            count = Math.floor(1 + Math.random() * (1.5 + progress * 2.5));
        } else if (this.gameMode === 'ZEN') {
            count = Math.floor(2 + Math.random() * 3);
        } else if (this.gameMode === 'ARCADE') {
            const frenzyActive = this.activePowerups.frenzy > now;
            if (frenzyActive) {
                count = Math.floor(3 + Math.random() * 4); // Frenzy! Spawns lots of fruits
            } else {
                count = Math.floor(1 + Math.random() * 3);
            }
        }
        
        // Adjust for freeze
        if (freezeActive && !this.activePowerups.frenzy > now) {
            count = Math.max(1, count - 1);
        }
        
        for (let i = 0; i < count; i++) {
            this.spawnIndividual(i, count);
        }
    }
    
    spawnIndividual(index, total) {
        const spawnX = 100 + Math.random() * (this.width - 200);
        const spawnY = this.height + 40;
        
        // Base launch parameters (higher points need more arc control)
        const targetX = this.width / 2 + (Math.random() - 0.5) * (this.width * 0.6);
        const timeToPeak = 65 + Math.random() * 25; // frames to peak
        
        // Calculate X velocity to land near target
        const vx = (targetX - spawnX) / timeToPeak;
        
        // Calculate Y launch velocity to reach a height proportionate to target peak
        const targetPeakHeight = 60 + Math.random() * (this.height * 0.4);
        const distanceToPeak = spawnY - targetPeakHeight;
        
        // v^2 = u^2 + 2as => u = sqrt(2as)
        const vy = -Math.sqrt(2 * GRAVITY * distanceToPeak);
        
        const spinSpeed = (Math.random() - 0.5) * 0.09;
        
        // Decide what object to spawn
        let objectType = 'FRUIT'; // FRUIT, BOMB, POWERUP
        const now = performance.now();
        
        const rand = Math.random();
        
        if (this.gameMode === 'CLASSIC') {
            // Bombs appear progressively as score rises
            const bombChance = Math.min(0.05 + (this.score / 250) * 0.25, 0.28);
            if (rand < bombChance) {
                objectType = 'BOMB';
            }
        } else if (this.gameMode === 'ZEN') {
            // No bombs or powerups
            objectType = 'FRUIT';
        } else if (this.gameMode === 'ARCADE') {
            // 20% Bomb chance, 12% Powerup Banana chance
            const frenzyActive = this.activePowerups.frenzy > now;
            
            if (frenzyActive) {
                // No bombs during frenzy! Pure fun
                objectType = rand < 0.12 ? 'POWERUP' : 'FRUIT';
            } else {
                if (rand < 0.16) {
                    objectType = 'BOMB';
                } else if (rand < 0.26) {
                    objectType = 'POWERUP';
                }
            }
        }
        
        let obj = null;
        let chosenConfig = null;
        if (objectType === 'BOMB') {
            obj = new BombObject(spawnX, spawnY, vx, vy, spinSpeed);
            window.gameAudio.startFuseSizzle();
        } else if (objectType === 'POWERUP') {
            const types = Object.keys(ARCADE_POWERUPS);
            const chosen = ARCADE_POWERUPS[types[Math.floor(Math.random() * types.length)]];
            obj = new PowerupBanana(spawnX, spawnY, vx, vy, spinSpeed, chosen);
            chosenConfig = chosen;
        } else {
            const keys = Object.keys(FRUIT_TYPES);
            const chosen = FRUIT_TYPES[keys[Math.floor(Math.random() * keys.length)]];
            obj = new FruitObject(spawnX, spawnY, vx, vy, spinSpeed, chosen);
            chosenConfig = chosen;
        }
        
        obj.id = this.fruitIdCounter++;
        this.fruits.push(obj);
        
        // Broadcast spawn if host
        if (this.isMultiplayer && window.gameMultiplayer.isHost) {
            window.gameMultiplayer.broadcast({
                type: 'spawn',
                id: obj.id,
                objectType: objectType,
                x: spawnX,
                y: spawnY,
                vx: vx,
                vy: vy,
                spinSpeed: spinSpeed,
                powerupType: obj.powerupType || null,
                fruitTypeName: objectType === 'FRUIT' ? Object.keys(FRUIT_TYPES).find(key => FRUIT_TYPES[key].name === obj.name) : null
            });
        }
    }
    
    // Line-circle intersection test
    lineCircleIntersect(p1, p2, circle, radius) {
        const ab = { x: p2.x - p1.x, y: p2.y - p1.y };
        const ac = { x: circle.x - p1.x, y: circle.y - p1.y };
        
        const abLenSq = ab.x * ab.x + ab.y * ab.y;
        if (abLenSq === 0) return Math.hypot(circle.x - p1.x, circle.y - p1.y) <= radius;
        
        // Projection factor t (clamped to 0..1 to define the segment)
        let t = (ac.x * ab.x + ac.y * ab.y) / abLenSq;
        t = Math.max(0, Math.min(1, t));
        
        const closestPoint = {
            x: p1.x + t * ab.x,
            y: p1.y + t * ab.y
        };
        
        const distSq = (circle.x - closestPoint.x) ** 2 + (circle.y - closestPoint.y) ** 2;
        return distSq <= radius * radius;
    }
    
    checkCollisions() {
        if (this.swipePoints.length < 2) return;
        
        const p1 = this.swipePoints[this.swipePoints.length - 2];
        const p2 = this.swipePoints[this.swipePoints.length - 1];
        
        for (const obj of this.fruits) {
            if (obj.sliced) continue;
            
            if (this.lineCircleIntersect(p1, p2, obj, obj.radius)) {
                const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                if (this.isMultiplayer) {
                    if (window.gameMultiplayer.isHost) {
                        this.verifyHostSlice(obj.id, angle, obj.x, obj.y);
                    } else {
                        window.gameMultiplayer.send({
                            type: 'slice',
                            id: obj.id,
                            angle: angle,
                            hitX: obj.x,
                            hitY: obj.y
                        });
                    }
                } else {
                    this.sliceObject(obj, p1, p2);
                }
            }
        }
    }
    
    // --- WebRTC Multiplayer Sync Hooks ---
    
    syncSpawnFruit(data) {
        let obj = null;
        if (data.objectType === 'BOMB') {
            obj = new BombObject(data.x, data.y, data.vx, data.vy, data.spinSpeed);
            window.gameAudio.startFuseSizzle();
        } else if (data.objectType === 'POWERUP') {
            const types = Object.keys(ARCADE_POWERUPS);
            const chosen = ARCADE_POWERUPS[types.find(key => ARCADE_POWERUPS[key].type === data.powerupType)];
            obj = new PowerupBanana(data.x, data.y, data.vx, data.vy, data.spinSpeed, chosen);
        } else {
            const chosen = FRUIT_TYPES[data.fruitTypeName];
            obj = new FruitObject(data.x, data.y, data.vx, data.vy, data.spinSpeed, chosen);
        }
        
        obj.id = data.id;
        this.fruits.push(obj);
    }
    
    verifyClientSlice(fruitId, angle, hitX, hitY, peerId) {
        const obj = this.fruits.find(f => f.id === fruitId);
        if (!obj || obj.sliced) return;
        
        const player = window.gameMultiplayer.players.find(p => p.id === peerId);
        if (!player) return;
        
        if (obj.isBomb) {
            player.score = Math.max(0, player.score - 10);
            window.gameMultiplayer.broadcast({
                type: 'bomb-slice',
                fruitId: fruitId,
                peerId: peerId,
                players: window.gameMultiplayer.players
            });
            this.triggerBombExplosionLocal(obj);
            this.updateMultiplayerScoreboardHUD();
        } else {
            // Increment score for the slicing player
            player.score += obj.points;
            
            // Broadcast slice confirmation to all clients
            window.gameMultiplayer.broadcast({
                type: 'slice-confirmed',
                id: fruitId,
                peerId: peerId,
                hitX: hitX,
                hitY: hitY,
                angle: angle,
                players: window.gameMultiplayer.players
            });
            
            // Execute locally on Host's Spectator screen
            this.executeSliceLocal(obj, hitX, hitY, angle, peerId);
            this.updateMultiplayerScoreboardHUD();
        }
    }
    
    syncSliceExecution(data) {
        const obj = this.fruits.find(f => f.id === data.id);
        if (!obj) return;
        
        // Sync players database and re-render HUD sidebar scoreboard
        window.gameMultiplayer.players = data.players;
        this.updateMultiplayerScoreboardHUD();
        
        // Sync stats if it was us
        const isMe = data.peerId === window.gameMultiplayer.myPeerId;
        if (isMe) {
            this.score = window.gameMultiplayer.players.find(p => p.id === window.gameMultiplayer.myPeerId).score;
            this.slicedCount++;
            
            this.swipeSliceQueue.push(obj);
            if (this.comboResetTimer) clearTimeout(this.comboResetTimer);
            this.comboResetTimer = setTimeout(() => this.evaluateCombo(), 180);
        }
        
        this.executeSliceLocal(obj, data.hitX, data.hitY, data.angle, data.peerId);
    }
    
    syncBombExplosion(data) {
        const obj = this.fruits.find(f => f.id === data.fruitId);
        if (!obj) return;
        
        // Sync players list
        window.gameMultiplayer.players = data.players;
        this.updateMultiplayerScoreboardHUD();
        
        const isMe = data.peerId === window.gameMultiplayer.myPeerId;
        if (isMe) {
            this.score = window.gameMultiplayer.players.find(p => p.id === window.gameMultiplayer.myPeerId).score;
            this.showNegativePointsIndicator(obj.x, obj.y, -10);
        }
        
        this.triggerBombExplosionLocal(obj);
    }
    
    executeSliceLocal(obj, hitX, hitY, angle, peerId) {
        obj.sliced = true;
        obj.sliceAngle = angle;
        
        window.gameAudio.playSplat(obj.powerupType || 'default');
        
        // Split halves
        const leftHalf = {
            x: obj.x,
            y: obj.y,
            vx: obj.vx - Math.sin(angle) * 3 - Math.cos(angle) * 1.5,
            vy: obj.vy + Math.cos(angle) * 3 - Math.sin(angle) * 1.5,
            spin: -0.06 - Math.random() * 0.05
        };
        const rightHalf = {
            x: obj.x,
            y: obj.y,
            vx: obj.vx + Math.sin(angle) * 3 + Math.cos(angle) * 1.5,
            vy: obj.vy - Math.cos(angle) * 3 + Math.sin(angle) * 1.5,
            spin: 0.06 + Math.random() * 0.05
        };
        obj.halves = [leftHalf, rightHalf];
        
        // Resolve slicing player color
        let splatColor = obj.juiceColor;
        const player = window.gameMultiplayer.players.find(p => p.id === peerId);
        if (player) {
            splatColor = player.color;
        }
        
        this.backgroundSplats.push(new BackgroundSplat(hitX, hitY, splatColor));
        
        // Particles
        const particleCount = 10 + Math.floor(Math.random() * 6);
        for (let i = 0; i < particleCount; i++) {
            const pAngle = angle + (Math.random() - 0.5) * Math.PI;
            const speed = 2 + Math.random() * 5;
            const vx = Math.cos(pAngle) * speed + obj.vx * 0.5;
            const vy = Math.sin(pAngle) * speed + obj.vy * 0.5;
            this.particles.push(new JuiceParticle(hitX, hitY, vx, vy, splatColor));
        }
        
        if (obj.isPowerup) {
            this.activatePowerup(obj.powerupType);
        }
    }
    
    triggerBombExplosionLocal(obj) {
        obj.sliced = true;
        window.gameAudio.playExplosion();
        this.triggerScreenShake(15, 500);
        
        for (let i = 0; i < 30; i++) {
            const pAngle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 8;
            const vx = Math.cos(pAngle) * speed;
            const vy = Math.sin(pAngle) * speed;
            const color = Math.random() > 0.4 ? '#ff5e00' : '#444';
            this.particles.push(new ExplosionParticle(obj.x, obj.y, vx, vy, color));
        }
    }
    
    updateMultiplayerScoreboardHUD() {
        const scoreboard = document.getElementById('mp-scoreboard-list');
        if (!scoreboard) return;
        scoreboard.innerHTML = '';
        
        // Sort players by score descending
        const sorted = [...window.gameMultiplayer.players].sort((a, b) => b.score - a.score);
        
        sorted.forEach(p => {
            const isMe = p.id === window.gameMultiplayer.myPeerId;
            const item = document.createElement('div');
            item.className = `mp-scoreboard-item ${isMe ? 'is-me' : ''}`;
            
            const displayName = isMe ? `${p.name} (BẠN)` : p.name;
            
            item.innerHTML = `
                <div class="player-name-tag">
                    <span class="player-color-dot" style="background-color: ${p.color}; color: ${p.color}"></span>
                    <span>${displayName}</span>
                </div>
                <span class="player-score-tag">${p.score}</span>
            `;
            scoreboard.appendChild(item);
        });
    }
    
    sliceObject(obj, p1, p2) {
        obj.sliced = true;
        
        // Slicing angle based on the swipe segment
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        obj.sliceAngle = angle;
        
        // Spawn splat details
        const hitX = obj.x;
        const hitY = obj.y;
        
        if (obj.isBomb) {
            this.handleBombSlice(obj);
        } else {
            this.handleFruitSlice(obj, hitX, hitY, angle);
        }
    }
    
    handleFruitSlice(obj, x, y, angle) {
        this.slicedCount++;
        
        // Check active double points powerup
        const now = performance.now();
        const doubleActive = this.activePowerups.double > now;
        const pointMultiplier = doubleActive ? 2 : 1;
        
        // Score points
        this.score += obj.points * pointMultiplier;
        document.getElementById('score-val').innerText = this.score;
        
        // Add to active swipe queue for combos
        this.swipeSliceQueue.push(obj);
        
        // Restart/delay combo evaluations
        if (this.comboResetTimer) clearTimeout(this.comboResetTimer);
        this.comboResetTimer = setTimeout(() => {
            this.evaluateCombo();
        }, 180);
        
        // Sound and visuals
        window.gameAudio.playSplat(obj.powerupType || 'default');
        this.triggerScreenShake(3, 100);
        
        // Slice Halves
        // Left Half gets dynamic offset impulse
        const leftHalf = {
            x: obj.x,
            y: obj.y,
            vx: obj.vx - Math.sin(angle) * 3 - Math.cos(angle) * 1.5,
            vy: obj.vy + Math.cos(angle) * 3 - Math.sin(angle) * 1.5,
            spin: -0.06 - Math.random() * 0.05
        };
        const rightHalf = {
            x: obj.x,
            y: obj.y,
            vx: obj.vx + Math.sin(angle) * 3 + Math.cos(angle) * 1.5,
            vy: obj.vy - Math.cos(angle) * 3 + Math.sin(angle) * 1.5,
            spin: 0.06 + Math.random() * 0.05
        };
        
        obj.halves = [leftHalf, rightHalf];
        
        // Create splat on wood background
        this.backgroundSplats.push(new BackgroundSplat(x, y, obj.juiceColor));
        
        // Spawn juice particles
        const particleCount = 12 + Math.floor(Math.random() * 8);
        for (let i = 0; i < particleCount; i++) {
            const pAngle = angle + (Math.random() - 0.5) * Math.PI; // Splatter spreads along the slice angle
            const speed = 2 + Math.random() * 6;
            const vx = Math.cos(pAngle) * speed + obj.vx * 0.5;
            const vy = Math.sin(pAngle) * speed + obj.vy * 0.5;
            this.particles.push(new JuiceParticle(x, y, vx, vy, obj.juiceColor));
        }
        
        // Trigger Powerup triggers
        if (obj.isPowerup) {
            this.activatePowerup(obj.powerupType);
        }
    }
    
    handleBombSlice(obj) {
        window.gameAudio.playExplosion();
        this.triggerScreenShake(20, 600);
        
        // Create multiple fiery/smoke particles
        for (let i = 0; i < 40; i++) {
            const pAngle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 10;
            const vx = Math.cos(pAngle) * speed;
            const vy = Math.sin(pAngle) * speed;
            const color = Math.random() > 0.4 ? '#ff5e00' : (Math.random() > 0.5 ? '#ffcc00' : '#444');
            this.particles.push(new ExplosionParticle(obj.x, obj.y, vx, vy, color));
        }
        
        if (this.gameMode === 'CLASSIC') {
            // Classic = Game Over instantly!
            this.gameOver();
        } else if (this.gameMode === 'ARCADE') {
            // Arcade = Deduct 10 points and highlight score
            this.score = Math.max(0, this.score - 10);
            document.getElementById('score-val').innerText = this.score;
            this.showNegativePointsIndicator(obj.x, obj.y, -10);
        }
    }
    
    // Arcade Special Actions
    activatePowerup(type) {
        const duration = ARCADE_POWERUPS[type.toUpperCase()].duration;
        const now = performance.now();
        this.activePowerups[type] = now + duration;
        
        this.updatePowerupHUD();
        
        // Add nice announcement banner
        this.spawnFloatingAnnouncement(
            ARCADE_POWERUPS[type.toUpperCase()].name, 
            this.width / 2, 
            this.height / 3, 
            true
        );
    }
    
    updatePowerupHUD() {
        const now = performance.now();
        const hud = document.getElementById('powerup-hud');
        
        const frenzy = this.activePowerups.frenzy > now;
        const freeze = this.activePowerups.freeze > now;
        const double = this.activePowerups.double > now;
        
        if (frenzy || freeze || double) {
            hud.classList.remove('hidden');
            
            document.getElementById('power-frenzy').style.display = frenzy ? 'block' : 'none';
            document.getElementById('power-freeze').style.display = freeze ? 'block' : 'none';
            document.getElementById('power-double').style.display = double ? 'block' : 'none';
        } else {
            hud.classList.add('hidden');
        }
    }
    
    evaluateCombo() {
        if (this.swipeSliceQueue.length >= 3) {
            const count = this.swipeSliceQueue.length;
            const comboPoints = count; // Extra points match the count!
            
            // Apply double points multiplier
            const now = performance.now();
            const doubleActive = this.activePowerups.double > now;
            const pointsGained = comboPoints * (doubleActive ? 2 : 1);
            
            this.score += pointsGained;
            document.getElementById('score-val').innerText = this.score;
            
            if (count > this.maxCombo) {
                this.maxCombo = count;
            }
            
            // Audio Chime
            window.gameAudio.playCombo(count);
            
            // Find mid point of the combo slices for banner
            let avgX = 0;
            let avgY = 0;
            this.swipeSliceQueue.forEach(f => {
                avgX += f.x;
                avgY += f.y;
            });
            avgX /= count;
            avgY /= count;
            
            // Trigger visual HUD and Floating combo indicator
            this.triggerComboHUD(count);
            this.spawnFloatingAnnouncement(`${count}x Combo! +${pointsGained}`, avgX, avgY, false, count >= 5);
        }
        this.swipeSliceQueue = [];
    }
    
    triggerComboHUD(count) {
        const comboDiv = document.getElementById('combo-display');
        document.getElementById('combo-count').innerText = `${count}x`;
        comboDiv.classList.remove('show');
        void comboDiv.offsetWidth; // trigger reflow
        comboDiv.classList.add('show');
    }
    
    spawnFloatingAnnouncement(text, x, y, isBig = false, isMega = false) {
        const layer = document.getElementById('announcement-layer');
        const flash = document.createElement('div');
        flash.className = `combo-flash ${isMega ? 'size-mega' : ''}`;
        flash.innerText = text;
        flash.style.left = `${x}px`;
        flash.style.top = `${y}px`;
        
        layer.appendChild(flash);
        
        // Remove after animation completes
        setTimeout(() => {
            flash.remove();
        }, 850);
    }
    
    showNegativePointsIndicator(x, y, amount) {
        const layer = document.getElementById('announcement-layer');
        const flash = document.createElement('div');
        flash.className = 'combo-flash size-mega';
        flash.style.color = '#ff3b30';
        flash.innerText = `${amount}`;
        flash.style.left = `${x}px`;
        flash.style.top = `${y}px`;
        flash.style.textShadow = '0 0 15px rgba(255, 59, 48, 0.9)';
        
        layer.appendChild(flash);
        setTimeout(() => {
            flash.remove();
        }, 800);
    }
    
    triggerScreenShake(intensity, duration) {
        this.shakeIntensity = intensity;
        this.shakeTime = duration;
    }
    
    // --- Leaderboard Database ---
    
    checkHighScoreEligibility(mode, score) {
        const scores = this.getLeaderboard(mode);
        if (scores.length < 5) return true;
        return score > scores[scores.length - 1].score;
    }
    
    saveHighScore(mode, name, score) {
        let scores = this.getLeaderboard(mode);
        scores.push({ name, score, date: new Date().toLocaleDateString('vi-VN') });
        // Sort descending
        scores.sort((a, b) => b.score - a.score);
        // Slice top 5
        scores = scores.slice(0, 5);
        localStorage.setItem(`fruitSlasher_scores_${mode}`, JSON.stringify(scores));
    }
    
    getLeaderboard(mode) {
        const raw = localStorage.getItem(`fruitSlasher_scores_${mode}`);
        return raw ? JSON.parse(raw) : [];
    }
    
    renderLeaderboard(mode) {
        const list = document.getElementById('leaderboard-list');
        list.innerHTML = '';
        
        const scores = this.getLeaderboard(mode);
        if (scores.length === 0) {
            list.innerHTML = '<li class="no-scores-msg">Chưa có kỷ lục nào. Hãy chơi để ghi danh!</li>';
            return;
        }
        
        scores.forEach((entry, i) => {
            const li = document.createElement('li');
            li.className = `leaderboard-item rank-${i + 1}`;
            li.innerHTML = `
                <div class="player-info">
                    <span class="rank-badge">${i + 1}</span>
                    <span class="player-name">${this.escapeHTML(entry.name)}</span>
                </div>
                <span class="player-score">${entry.score} đ</span>
            `;
            list.appendChild(li);
        });
    }
    
    escapeHTML(str) {
        return str.replace(/[&<>'"]/g, 
            tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
        );
    }
    
    // --- Core Game Loop ---
    
    loop(timestamp) {
        if (!this.lastTime) this.lastTime = timestamp;
        let delta = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        // Cap large frame gaps (e.g., tab backgrounding)
        if (delta > 100) delta = 16.66; 
        
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        // Save state before screen shake translation
        this.ctx.save();
        if (this.shakeTime > 0) {
            const dx = (Math.random() - 0.5) * this.shakeIntensity;
            const dy = (Math.random() - 0.5) * this.shakeIntensity;
            this.ctx.translate(dx, dy);
            this.shakeTime -= delta;
        }
        
        if (this.gameState === 'PLAYING') {
            this.update(delta);
        }
        
        this.draw();
        
        this.ctx.restore();
        
        requestAnimationFrame((t) => this.loop(t));
    }
    
    update(delta) {
        const now = performance.now();
        const freezeActive = this.activePowerups.freeze > now;
        
        // Gravity modifier for Freeze powerup
        const timeScale = freezeActive ? 0.35 : 1.0;
        const adjustedGravity = GRAVITY * timeScale;
        
        // Handle Game Mode Timers
        if (this.gameMode === 'ZEN' || this.gameMode === 'ARCADE') {
            if (this.isMultiplayer) {
                if (window.gameMultiplayer.isHost) {
                    this.timeRemaining -= delta / 1000;
                    const displaySec = Math.max(0, Math.ceil(this.timeRemaining));
                    document.getElementById('timer-val').innerText = displaySec;
                    
                    // Sync time with Client once per second
                    if (displaySec !== this.lastSyncedTime) {
                        this.lastSyncedTime = displaySec;
                        window.gameMultiplayer.broadcast({
                            type: 'sync-time',
                            time: this.timeRemaining
                        });
                    }
                    
                    if (this.timeRemaining <= 0) {
                        this.gameOver();
                        return;
                    }
                } else {
                    // Client just displays what was synchronized
                    document.getElementById('timer-val').innerText = Math.max(0, Math.ceil(this.timeRemaining));
                }
            } else {
                this.timeRemaining -= delta / 1000;
                document.getElementById('timer-val').innerText = Math.max(0, Math.ceil(this.timeRemaining));
                
                if (this.timeRemaining <= 0) {
                    this.gameOver();
                    return;
                }
            }
        }
        
        // Handle spawning (Only Host spawns in multiplayer)
        if (!this.isMultiplayer || window.gameMultiplayer.isHost) {
            this.spawnTimer += delta;
            
            // Double fruit spawner speed if Frenzy active
            const frenzyActive = (this.gameMode === 'ARCADE' && this.activePowerups.frenzy > now);
            const adjustedInterval = frenzyActive ? this.spawnInterval * 0.4 : this.spawnInterval;
            
            if (this.spawnTimer >= adjustedInterval) {
                this.spawnFruitWave();
                this.spawnTimer = 0;
            }
        }
        
        // Background Splats Updates
        for (let i = this.backgroundSplats.length - 1; i >= 0; i--) {
            const splat = this.backgroundSplats[i];
            splat.update(delta);
            if (splat.alpha <= 0) {
                this.backgroundSplats.splice(i, 1);
            }
        }
        
        // Fruits Updates
        let bombStillActive = false;
        for (let i = this.fruits.length - 1; i >= 0; i--) {
            const obj = this.fruits[i];
            obj.update(adjustedGravity, timeScale);
            
            if (obj.isBomb && !obj.sliced) {
                bombStillActive = true;
            }
            
            // Check boundary bounds
            if (obj.isOutOfBounds(this.height)) {
                // If classic fruit dropped without slicing, lose a life
                if (this.gameMode === 'CLASSIC' && !obj.sliced && !obj.isBomb) {
                    this.loseLife();
                }
                this.fruits.splice(i, 1);
            }
        }
        
        // Start/Stop fuse sizzle sound based on bomb counts
        if (!bombStillActive) {
            window.gameAudio.stopFuseSizzle();
        }
        
        // Particles updates
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.update(adjustedGravity);
            if (p.life <= 0) {
                this.particles.splice(i, 1);
            }
        }
        
        // Check powerup timer expirations to update HUD
        this.updatePowerupHUD();
    }
    
    draw() {
        const now = performance.now();
        
        // 1. Draw Background Splats
        for (const splat of this.backgroundSplats) {
            splat.draw(this.ctx);
        }
        
        // 2. Frost filter on screen edges if Freeze active
        if (this.gameState === 'PLAYING' && this.activePowerups.freeze > now) {
            const gradient = this.ctx.createRadialGradient(
                this.width / 2, this.height / 2, this.width / 3,
                this.width / 2, this.height / 2, this.width * 0.7
            );
            gradient.addColorStop(0, 'rgba(0, 122, 255, 0)');
            gradient.addColorStop(0.8, 'rgba(90, 200, 250, 0.08)');
            gradient.addColorStop(1, 'rgba(0, 122, 255, 0.28)');
            
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.width, this.height);
        }
        
        // 3. Draw Fruits
        for (const obj of this.fruits) {
            obj.draw(this.ctx);
        }
        
        // 4. Draw Particles
        for (const p of this.particles) {
            p.draw(this.ctx);
        }
        
        // 5. Draw Glowing Blade Swipe Trail
        if (this.isSlicing && this.swipePoints.length >= 2) {
            const points = this.swipePoints;
            
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#fff';
            
            // Clean trail path
            this.ctx.beginPath();
            this.ctx.moveTo(points[0].x, points[0].y);
            
            for (let i = 1; i < points.length; i++) {
                // Smooth line drawing
                const xc = (points[i].x + points[i - 1].x) / 2;
                const yc = (points[i].y + points[i - 1].y) / 2;
                this.ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
            }
            
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 4;
            this.ctx.lineCap = 'round';
            this.ctx.lineJoin = 'round';
            this.ctx.stroke();
            
            // Outer blade neon sheath
            this.ctx.beginPath();
            this.ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                const xc = (points[i].x + points[i - 1].x) / 2;
                const yc = (points[i].y + points[i - 1].y) / 2;
                this.ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
            }
            this.ctx.strokeStyle = 'rgba(255, 94, 0, 0.45)';
            this.ctx.lineWidth = 10;
            this.ctx.stroke();
            
            this.ctx.shadowBlur = 0; // reset
        }
        
        // 6. Draw Player Trails (Only Host draws all player trails in multiplayer)
        if (this.isMultiplayer && window.gameMultiplayer.players) {
            window.gameMultiplayer.players.forEach(p => {
                // If it is client, they only draw their own trail (already done above)
                const isMe = p.id === window.gameMultiplayer.myPeerId;
                if (!window.gameMultiplayer.isHost && isMe) return; 
                
                const points = p.swipePoints;
                if (!points || points.length < 2) return;
                
                this.ctx.save();
                this.ctx.shadowBlur = 15;
                this.ctx.shadowColor = p.color;
                
                this.ctx.beginPath();
                this.ctx.moveTo(points[0].x, points[0].y);
                
                for (let i = 1; i < points.length; i++) {
                    const xc = (points[i].x + points[i - 1].x) / 2;
                    const yc = (points[i].y + points[i - 1].y) / 2;
                    this.ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
                }
                
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 4;
                this.ctx.lineCap = 'round';
                this.ctx.lineJoin = 'round';
                this.ctx.stroke();
                
                // Outer neon sheath in player color
                this.ctx.beginPath();
                this.ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    const xc = (points[i].x + points[i - 1].x) / 2;
                    const yc = (points[i].y + points[i - 1].y) / 2;
                    this.ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, xc, yc);
                }
                this.ctx.strokeStyle = p.color + '73'; // 45% transparency hex alpha is 73
                this.ctx.lineWidth = 10;
                this.ctx.stroke();
                
                this.ctx.restore();
            });
        }
    }
}

// --- Object Classes ---

class FruitObject {
    constructor(x, y, vx, vy, spinSpeed, config) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.angle = Math.random() * Math.PI * 2;
        this.spinSpeed = spinSpeed;
        this.radius = config.radius;
        this.points = config.points;
        this.color = config.color;
        this.juiceColor = config.juiceColor;
        this.name = config.name;
        
        this.sliced = false;
        this.sliceAngle = 0;
        this.halves = [];
        this.isBomb = false;
        this.isPowerup = false;
    }
    
    update(gravity, timeScale) {
        if (!this.sliced) {
            this.x += this.vx * timeScale;
            this.y += this.vy * timeScale;
            this.vy += gravity;
            this.angle += this.spinSpeed * timeScale;
        } else {
            // Update split halves
            for (const half of this.halves) {
                half.x += half.vx * timeScale;
                half.y += half.vy * timeScale;
                half.vy += gravity;
                half.angle = (half.angle || 0) + half.spin * timeScale;
            }
        }
    }
    
    isOutOfBounds(screenHeight) {
        if (!this.sliced) {
            return this.y > screenHeight + 50 && this.vy > 0;
        } else {
            // Out of bounds when both halves fall off
            return this.halves.every(h => h.y > screenHeight + 50);
        }
    }
    
    draw(ctx) {
        ctx.save();
        
        if (!this.sliced) {
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            this.drawProcedural(ctx, this.radius, false);
        } else {
            // Draw both halves
            this.halves.forEach((half, index) => {
                ctx.save();
                ctx.translate(half.x, half.y);
                ctx.rotate(half.angle || 0);
                this.drawProcedural(ctx, this.radius, true, index === 0 ? 'left' : 'right');
                ctx.restore();
            });
        }
        
        ctx.restore();
    }
    
    // Renders highly detailed, vector-style gradients for fruits
    drawProcedural(ctx, r, isSplit, side = 'left') {
        // Shadows
        if (!isSplit) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetY = 6;
        }
        
        const isRight = side === 'right';
        
        // If split, apply clipping to render only half the circle
        if (isSplit) {
            ctx.beginPath();
            if (isRight) {
                ctx.arc(0, 0, r + 4, -Math.PI / 2, Math.PI / 2);
            } else {
                ctx.arc(0, 0, r + 4, Math.PI / 2, -Math.PI / 2);
            }
            ctx.clip();
        }
        
        if (this.name === 'Cam') {
            //Cam (Orange)
            // Outer skin
            ctx.fillStyle = '#e65c00';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            
            // White pith
            ctx.fillStyle = '#ffffe0';
            ctx.beginPath();
            ctx.arc(0, 0, r - 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Pulp wedges (Segments)
            ctx.fillStyle = '#ff9500';
            const segments = 8;
            for (let i = 0; i < segments; i++) {
                const angle1 = (i * Math.PI * 2) / segments + 0.05;
                const angle2 = ((i + 1) * Math.PI * 2) / segments - 0.05;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, r - 6, angle1, angle2);
                ctx.closePath();
                ctx.fill();
            }
            
            // Central core
            ctx.fillStyle = '#ffffe0';
            ctx.beginPath();
            ctx.arc(0, 0, 3, 0, Math.PI * 2);
            ctx.fill();
            
        } else if (this.name === 'Dưa hấu') {
            // Dưa hấu (Watermelon)
            // Outer Green Skin
            ctx.fillStyle = '#1e3f20';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            
            // Medium Light Green Rind
            ctx.fillStyle = '#a3c9a8';
            ctx.beginPath();
            ctx.arc(0, 0, r - 4, 0, Math.PI * 2);
            ctx.fill();
            
            // Red inner flesh
            const radialGrad = ctx.createRadialGradient(0, 0, 5, 0, 0, r - 8);
            radialGrad.addColorStop(0, '#ff453a');
            radialGrad.addColorStop(0.85, '#ff2d55');
            radialGrad.addColorStop(1, '#ff3b30');
            ctx.fillStyle = radialGrad;
            
            ctx.beginPath();
            ctx.arc(0, 0, r - 7, 0, Math.PI * 2);
            ctx.fill();
            
            // Watermelon seeds (simple little black dots)
            ctx.fillStyle = '#000';
            const seeds = [
                { x: -r * 0.3, y: -r * 0.3 }, { x: r * 0.3, y: -r * 0.3 },
                { x: -r * 0.4, y: r * 0.1 }, { x: r * 0.4, y: r * 0.1 },
                { x: 0, y: r * 0.4 }, { x: 0, y: -r * 0.1 }
            ];
            seeds.forEach(s => {
                ctx.beginPath();
                ctx.arc(s.x, s.y, 2, 0, Math.PI * 2);
                ctx.fill();
            });
            
        } else if (this.name === 'Táo') {
            // Táo (Apple)
            const appleGrad = ctx.createRadialGradient(-r*0.2, -r*0.2, 3, 0, 0, r);
            appleGrad.addColorStop(0, '#ff6b6b');
            appleGrad.addColorStop(0.8, '#e60000');
            appleGrad.addColorStop(1, '#990000');
            ctx.fillStyle = appleGrad;
            
            // Draw heart-like apple shape
            ctx.beginPath();
            ctx.arc(-r * 0.22, 0, r * 0.82, 0, Math.PI * 2);
            ctx.arc(r * 0.22, 0, r * 0.82, 0, Math.PI * 2);
            ctx.fill();
            
            // Apple stem
            ctx.strokeStyle = '#5c4033';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(0, -r * 0.6);
            ctx.quadraticCurveTo(5, -r * 1.1, 8, -r * 1.1);
            ctx.stroke();
            
            // Apple leaf
            ctx.fillStyle = '#2b5c2a';
            ctx.beginPath();
            ctx.ellipse(8, -r * 1.1, 8, 4, Math.PI / 4, 0, Math.PI * 2);
            ctx.fill();
            
        } else if (this.name === 'Dừa') {
            // Dừa (Coconut)
            // Brown shell
            ctx.fillStyle = '#4a2511';
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            
            // Inner white flesh
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, r - 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Middle empty space (translucent water effect)
            ctx.fillStyle = 'rgba(217, 243, 247, 0.45)';
            ctx.beginPath();
            ctx.arc(0, 0, r - 16, 0, Math.PI * 2);
            ctx.fill();
            
        } else if (this.name === 'Chuối') {
            // Chuối (Banana)
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            // Draw curved banana using two quadratic curves
            ctx.moveTo(-r, -r * 0.2);
            ctx.quadraticCurveTo(0, r * 0.8, r, -r * 0.2);
            ctx.quadraticCurveTo(0, r * 0.35, -r, -r * 0.2);
            ctx.closePath();
            ctx.fill();
            
            // Greenish tip
            ctx.fillStyle = '#8c9c1e';
            ctx.beginPath();
            ctx.moveTo(-r, -r * 0.2);
            ctx.quadraticCurveTo(-r * 0.8, -r * 0.05, -r * 0.7, -r * 0.1);
            ctx.quadraticCurveTo(-r * 0.85, -r * 0.2, -r, -r * 0.2);
            ctx.fill();
            
            // Black stalk tip
            ctx.fillStyle = '#222';
            ctx.beginPath();
            ctx.arc(r, -r * 0.2, 2.5, 0, Math.PI * 2);
            ctx.fill();
            
        } else if (this.name === 'Dứa') {
            // Dứa (Pineapple)
            // Spiky yellow body
            ctx.fillStyle = '#ffe600';
            ctx.beginPath();
            ctx.ellipse(0, r * 0.15, r * 0.8, r, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Diamond texture hatch lines
            ctx.strokeStyle = '#cc8800';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            for (let i = -r; i <= r; i += 12) {
                ctx.moveTo(i * 0.7, -r + r * 0.15);
                ctx.lineTo(i * 0.7 + r * 0.4, r + r * 0.15);
                ctx.moveTo(i * 0.7, -r + r * 0.15);
                ctx.lineTo(i * 0.7 - r * 0.4, r + r * 0.15);
            }
            ctx.stroke();
            
            // Leafy green crown on top
            ctx.fillStyle = '#2b5c2a';
            ctx.beginPath();
            ctx.moveTo(0, -r * 0.8);
            ctx.quadraticCurveTo(-15, -r * 1.5, -20, -r * 1.6);
            ctx.quadraticCurveTo(-5, -r * 1.2, 0, -r * 0.8);
            
            ctx.moveTo(0, -r * 0.8);
            ctx.quadraticCurveTo(15, -r * 1.5, 20, -r * 1.6);
            ctx.quadraticCurveTo(5, -r * 1.2, 0, -r * 0.8);
            
            ctx.moveTo(0, -r * 0.8);
            ctx.quadraticCurveTo(0, -r * 1.7, 0, -r * 1.95);
            ctx.quadraticCurveTo(0, -r * 1.3, 0, -r * 0.8);
            ctx.closePath();
            ctx.fill();
        }
        
        // Highlight shine gloss
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.beginPath();
        ctx.ellipse(-r * 0.35, -r * 0.35, r * 0.22, r * 0.12, Math.PI / 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Special powerup banana subclassing FruitObject logic
class PowerupBanana extends FruitObject {
    constructor(x, y, vx, vy, spinSpeed, config) {
        // Base initialization
        super(x, y, vx, vy, spinSpeed, {
            name: 'Chuối Đặc Biệt',
            radius: 38,
            color: config.color,
            juiceColor: config.glowColor,
            points: 0 // Powerups don't yield direct score, they trigger effects
        });
        
        this.isPowerup = true;
        this.powerupType = config.type;
        this.glowColor = config.glowColor;
    }
    
    drawProcedural(ctx, r, isSplit, side = 'left') {
        const isRight = side === 'right';
        
        if (isSplit) {
            ctx.beginPath();
            if (isRight) {
                ctx.arc(0, 0, r + 4, -Math.PI / 2, Math.PI / 2);
            } else {
                ctx.arc(0, 0, r + 4, Math.PI / 2, -Math.PI / 2);
            }
            ctx.clip();
        }
        
        // Magic outer glow shadow
        ctx.shadowColor = this.glowColor;
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 0;
        
        // Banana body with special neon powerup gradients
        const gradient = ctx.createLinearGradient(-r, -r, r, r);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.5, this.color);
        gradient.addColorStop(1, '#000000');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(-r, -r * 0.2);
        ctx.quadraticCurveTo(0, r * 0.8, r, -r * 0.2);
        ctx.quadraticCurveTo(0, r * 0.35, -r, -r * 0.2);
        ctx.closePath();
        ctx.fill();
        
        // Neon highlights
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.8, -r * 0.1);
        ctx.quadraticCurveTo(0, r * 0.55, r * 0.8, -r * 0.1);
        ctx.stroke();
    }
}

// Bomb Object
class BombObject {
    constructor(x, y, vx, vy, spinSpeed) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.angle = Math.random() * Math.PI * 2;
        this.spinSpeed = spinSpeed;
        this.radius = BOMB_RADIUS;
        
        this.sliced = false;
        this.isBomb = true;
        this.isPowerup = false;
        
        // Spark animations
        this.sparkTimer = 0;
        this.sparkPoints = [];
    }
    
    update(gravity, timeScale) {
        this.x += this.vx * timeScale;
        this.y += this.vy * timeScale;
        this.vy += gravity;
        this.angle += this.spinSpeed * timeScale;
        
        // Sizzle sparks
        this.sparkTimer += timeScale;
        if (this.sparkTimer >= 1.5) {
            this.sparkPoints.push({
                x: this.x + Math.sin(this.angle) * 12 + (Math.random() - 0.5) * 8,
                y: this.y - 32 + (Math.random() - 0.5) * 8,
                life: 1.0
            });
            this.sparkTimer = 0;
        }
        
        for (let i = this.sparkPoints.length - 1; i >= 0; i--) {
            this.sparkPoints[i].life -= 0.08 * timeScale;
            if (this.sparkPoints[i].life <= 0) {
                this.sparkPoints.splice(i, 1);
            }
        }
    }
    
    isOutOfBounds(screenHeight) {
        return this.y > screenHeight + 50 && this.vy > 0;
    }
    
    draw(ctx) {
        if (this.sliced) return; // bomb disappears instantly on slice due to explosion
        
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        
        // Shadow
        ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetY = 6;
        
        // Draw Main bomb sphere
        const radGrad = ctx.createRadialGradient(-6, -6, 2, 0, 0, this.radius);
        radGrad.addColorStop(0, '#555555');
        radGrad.addColorStop(0.65, '#222222');
        radGrad.addColorStop(1, '#0c0c0c');
        ctx.fillStyle = radGrad;
        
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Bomb Cap/Stem
        ctx.fillStyle = '#3a3a3a';
        ctx.fillRect(-6, -this.radius - 3, 12, 6);
        
        // Fuse rope
        ctx.strokeStyle = '#d2b48c';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, -this.radius - 3);
        ctx.quadraticCurveTo(8, -this.radius - 12, 12, -this.radius - 20);
        ctx.stroke();
        
        ctx.restore();
        
        // Draw Sparks fuse highlights (unrotated coordinate layer)
        ctx.save();
        for (const sp of this.sparkPoints) {
            const rad = 2 + Math.random() * 4;
            const grad = ctx.createRadialGradient(sp.x, sp.y, 0, sp.x, sp.y, rad * 1.5);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.3, '#ffcc00');
            grad.addColorStop(0.7, '#ff5e00');
            grad.addColorStop(1, 'rgba(255, 94, 0, 0)');
            
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(sp.x, sp.y, rad * 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
}

// Background juice splat class
class BackgroundSplat {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.alpha = 0.55;
        this.radius = 24 + Math.random() * 24;
        this.lifeTime = 2500 + Math.random() * 1500; // ms duration
        this.speedFade = this.alpha / this.lifeTime;
        
        // Random splat shapes (splashes of juice droplets around it)
        this.drops = [];
        const count = 4 + Math.floor(Math.random() * 5);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = this.radius * (0.5 + Math.random() * 1.2);
            this.drops.push({
                x: Math.cos(angle) * dist,
                y: Math.sin(angle) * dist,
                r: 3 + Math.random() * 6
            });
        }
    }
    
    update(delta) {
        this.alpha -= this.speedFade * delta;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.alpha);
        
        // Core Splat (blurred radial shape)
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
        grad.addColorStop(0, this.color);
        grad.addColorStop(0.8, this.color);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Surrounding splashes
        ctx.fillStyle = this.color;
        for (const drop of this.drops) {
            ctx.beginPath();
            ctx.arc(this.x + drop.x, this.y + drop.y, drop.r, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
}

// Juice Particle Class
class JuiceParticle {
    constructor(x, y, vx, vy, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.radius = 2.5 + Math.random() * 3.5;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.025;
    }
    
    update(gravity) {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += gravity;
        
        // Air resistance dampening
        this.vx *= 0.98;
        this.vy *= 0.98;
        
        this.life -= this.decay;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Explosion particle class (bombs)
class ExplosionParticle {
    constructor(x, y, vx, vy, color) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.radius = 5 + Math.random() * 15;
        this.life = 1.0;
        this.decay = 0.02 + Math.random() * 0.02;
    }
    
    update(gravity) {
        this.x += this.vx;
        this.y += this.vy;
        
        // Floating upward effect (smoke) or heavy blast
        this.vy += (gravity * 0.1); 
        this.vx *= 0.95;
        this.vy *= 0.95;
        
        this.radius += 0.3; // expands
        this.life -= this.decay;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        
        // High glow for fiery sparks
        if (this.color !== '#444') {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 15;
        }
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// Instantiate game engine
let game = null;
window.addEventListener('load', () => {
    game = new GameEngine();
});
