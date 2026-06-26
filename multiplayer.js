// WebRTC Multiplayer Manager for Fruit Slasher (using PeerJS)

class MultiplayerManager {
    constructor() {
        this.peer = null;
        this.conn = null;
        this.isHost = false;
        this.roomCode = '';
        this.opponentName = 'Đối thủ';
        this.opponentScore = 0;
        this.opponentSwipePoints = [];
        this.isActive = false;
        
        // References to panels
        this.initPanels();
    }
    
    initPanels() {
        this.dom = {
            screen: () => document.getElementById('multiplayer-screen'),
            initial: () => document.getElementById('mp-initial-panel'),
            host: () => document.getElementById('mp-host-panel'),
            client: () => document.getElementById('mp-client-panel'),
            roomInput: () => document.getElementById('join-room-input'),
            codeDisplay: () => document.getElementById('generated-room-code'),
            hostStatus: () => document.getElementById('host-status-text'),
            clientStatus: () => document.getElementById('client-status-text'),
            copyBtn: () => document.getElementById('btn-copy-code')
        };
    }
    
    showScreen() {
        window.gameAudio.playClick();
        document.getElementById('menu-screen').classList.add('hidden');
        this.dom.screen().classList.remove('hidden');
        this.dom.screen().classList.add('active');
        
        // Reset panels
        this.dom.initial().classList.remove('hidden');
        this.dom.host().classList.add('hidden');
        this.dom.client().classList.add('hidden');
        this.dom.roomInput().value = '';
        
        this.isActive = false;
        this.cleanup();
    }
    
    backToMenu() {
        window.gameAudio.playClick();
        this.cleanup();
        this.dom.screen().classList.add('hidden');
        this.dom.screen().classList.remove('active');
        document.getElementById('menu-screen').classList.remove('hidden');
        document.getElementById('menu-screen').classList.add('active');
    }
    
    cleanup() {
        this.isActive = false;
        if (this.conn) {
            try { this.conn.close(); } catch(e) {}
            this.conn = null;
        }
        if (this.peer) {
            try { this.peer.destroy(); } catch(e) {}
            this.peer = null;
        }
        this.isHost = false;
        this.roomCode = '';
        this.opponentSwipePoints = [];
        
        // Reset UI HUD
        document.getElementById('single-score-box').classList.remove('hidden');
        document.getElementById('multi-score-box').classList.add('hidden');
    }
    
    // --- Host Functions ---
    
    createRoom() {
        window.gameAudio.playClick();
        this.cleanup();
        this.isHost = true;
        this.dom.initial().classList.add('hidden');
        this.dom.host().classList.remove('hidden');
        this.dom.hostStatus().innerText = 'Đang kết nối tới server signaling...';
        
        // Generate random room code: e.g. FS + 4 digits
        const codeDigits = Math.floor(1000 + Math.random() * 9000);
        this.roomCode = `FS${codeDigits}`;
        this.dom.codeDisplay().innerText = this.roomCode;
        
        // Initialize PeerJS
        this.peer = new Peer(this.roomCode, {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });
        
        this.peer.on('open', (id) => {
            this.dom.hostStatus().innerText = 'Đang đợi đối thủ kết nối...';
            this.setupCopyButton();
        });
        
        this.peer.on('connection', (connection) => {
            if (this.conn) {
                // Already have a player, reject others
                connection.on('open', () => {
                    connection.send({ type: 'reject', reason: 'Room is full' });
                    setTimeout(() => connection.close(), 500);
                });
                return;
            }
            this.conn = connection;
            this.setupConnection();
        });
        
        this.peer.on('error', (err) => {
            console.error('PeerJS error:', err);
            this.dom.hostStatus().innerText = `Lỗi khởi tạo: Có thể mã phòng bị trùng. Vui lòng thử lại.`;
        });
    }
    
    setupCopyButton() {
        this.dom.copyBtn().onclick = () => {
            window.gameAudio.playClick();
            navigator.clipboard.writeText(this.roomCode).then(() => {
                const prevText = this.dom.copyBtn().innerText;
                this.dom.copyBtn().innerText = 'ĐÃ COPY';
                this.dom.copyBtn().style.background = '#4cd964';
                setTimeout(() => {
                    this.dom.copyBtn().innerText = prevText;
                    this.dom.copyBtn().style.background = '';
                }, 2000);
            });
        };
    }
    
    // --- Client Functions ---
    
    joinRoom() {
        window.gameAudio.playClick();
        const codeInput = this.dom.roomInput().value.trim().toUpperCase();
        if (!codeInput || codeInput.length < 5) {
            alert('Vui lòng nhập mã phòng hợp lệ!');
            return;
        }
        
        this.cleanup();
        this.isHost = false;
        this.roomCode = codeInput;
        
        this.dom.initial().classList.add('hidden');
        this.dom.client().classList.remove('hidden');
        this.dom.clientStatus().innerText = 'Đang khởi tạo kết nối...';
        
        // Client connects to peer server with random ID, then dials Host
        this.peer = new Peer(null, {
            debug: 1,
            config: {
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });
        
        this.peer.on('open', (id) => {
            this.dom.clientStatus().innerText = `Đang kết nối tới phòng ${this.roomCode}...`;
            
            // Connect to host room code
            this.conn = this.peer.connect(this.roomCode, {
                reliable: true
            });
            this.setupConnection();
        });
        
        this.peer.on('error', (err) => {
            console.error('Client PeerJS error:', err);
            this.dom.clientStatus().innerText = `Không tìm thấy phòng ${this.roomCode} hoặc lỗi kết nối.`;
        });
    }
    
    // --- Common Connection Handling ---
    
    setupConnection() {
        this.conn.on('open', () => {
            this.isActive = true;
            
            // Sync status
            if (this.isHost) {
                this.dom.hostStatus().innerText = 'Đã kết nối! Đang tải game...';
                // Send welcome message
                this.send({
                    type: 'welcome',
                    name: 'HOST'
                });
            } else {
                this.dom.clientStatus().innerText = 'Đã kết nối! Đang đợi host bắt đầu...';
            }
            
            // Hide connection screen and load Multiplayer game
            setTimeout(() => {
                this.dom.screen().classList.add('hidden');
                this.dom.screen().classList.remove('active');
                
                // Trigger multiplayer start in game engine
                if (window.gameInstance) {
                    window.gameInstance.startMultiplayerGame();
                }
            }, 1000);
        });
        
        this.conn.on('data', (data) => {
            this.handleIncomingData(data);
        });
        
        this.conn.on('close', () => {
            alert('Mất kết nối với đối thủ!');
            if (window.gameInstance) {
                window.gameInstance.exitToMenu();
            }
            this.cleanup();
        });
        
        this.conn.on('error', (err) => {
            console.error('Connection error:', err);
            alert('Lỗi đường truyền WebRTC!');
            if (window.gameInstance) {
                window.gameInstance.exitToMenu();
            }
            this.cleanup();
        });
    }
    
    send(data) {
        if (this.conn && this.conn.open) {
            this.conn.send(data);
        }
    }
    
    sendSwipe(points) {
        const coords = points.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
        this.send({
            type: 'swipe',
            points: coords
        });
    }
    
    // --- Data Processing Protocol ---
    
    handleIncomingData(data) {
        if (!data || !this.isActive) return;
        
        switch(data.type) {
            case 'welcome':
                this.opponentName = this.isHost ? 'GUEST' : 'HOST';
                break;
                
            case 'swipe':
                this.opponentSwipePoints = data.points;
                break;
                
            case 'spawn':
                if (!this.isHost && window.gameInstance) {
                    window.gameInstance.syncSpawnFruit(data);
                }
                break;
                
            case 'slice':
                if (this.isHost && window.gameInstance) {
                    window.gameInstance.verifyClientSlice(data.id, data.angle, data.hitX, data.hitY);
                }
                break;
                
            case 'slice-confirmed':
                if (window.gameInstance) {
                    window.gameInstance.syncSliceExecution(data);
                }
                break;
                
            case 'bomb-slice':
                if (window.gameInstance) {
                    window.gameInstance.syncBombExplosion(data);
                }
                break;
                
            case 'game-over':
                if (window.gameInstance) {
                    window.gameInstance.syncMultiplayerGameOver(data);
                }
                break;
                
            case 'sync-time':
                if (!this.isHost && window.gameInstance) {
                    window.gameInstance.timeRemaining = data.time;
                }
                break;
                
            case 'pause':
                if (window.gameInstance && window.gameInstance.gameState === 'PLAYING') {
                    window.gameInstance.syncPause();
                }
                break;
                
            case 'resume':
                if (window.gameInstance && window.gameInstance.gameState === 'PAUSED') {
                    window.gameInstance.syncResume();
                }
                break;
                
            case 'exit':
                if (window.gameInstance) {
                    window.gameInstance.exitToMenu();
                }
                break;
                
            case 'reject':
                alert(`Không thể kết nối: ${data.reason}`);
                this.cleanup();
                this.backToMenu();
                break;
        }
    }
}

// Global Singleton
const multiplayer = new MultiplayerManager();
window.gameMultiplayer = multiplayer;
