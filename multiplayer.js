// WebRTC Multiplayer Manager for Fruit Slasher (Host-Spectator Model)

class MultiplayerManager {
    constructor() {
        this.peer = null;
        this.connections = []; // For Host: list of client DataConnections
        this.conn = null;        // For Client: connection to Host
        
        this.isHost = false;
        this.roomCode = '';
        this.isActive = false;
        
        // Local Player Info (For Clients)
        this.myPeerId = '';
        this.myName = '';
        this.myColor = '';
        
        // Players Database (Synced across all peers)
        this.players = [];
        
        this.playerColors = [
            '#ff3b30', // Red
            '#00c6ff', // Cyan
            '#ffcc00', // Yellow
            '#4cd964', // Green
            '#af52de', // Purple
            '#ff9500', // Orange
            '#ff2d55', // Pink
            '#5ac8fa'  // Light Blue
        ];
        
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
            copyBtn: () => document.getElementById('btn-copy-code'),
            lobbyList: () => document.getElementById('mp-lobby-list'),
            startBtn: () => document.getElementById('btn-mp-start-game')
        };
    }
    
    showScreen() {
        window.gameAudio.playClick();
        document.getElementById('menu-screen').classList.add('hidden');
        this.dom.screen().classList.remove('hidden');
        this.dom.screen().classList.add('active');
        
        this.dom.initial().classList.remove('hidden');
        this.dom.host().classList.add('hidden');
        this.dom.client().classList.add('hidden');
        this.dom.roomInput().value = '';
        
        // Restore name from localStorage
        const savedName = localStorage.getItem('fruitSlasher_lastPlayer');
        const nameInput = document.getElementById('mp-player-name');
        if (savedName && nameInput) {
            nameInput.value = savedName;
        }
        
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
        
        // Close Host connections
        this.connections.forEach(c => {
            try { c.close(); } catch(e) {}
        });
        this.connections = [];
        
        // Close Client connection
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
        this.players = [];
        this.myPeerId = '';
        this.myName = '';
        this.myColor = '';
        
        // Hide buttons
        if (this.dom.startBtn()) this.dom.startBtn().classList.add('hidden');
        if (this.dom.lobbyList()) {
            this.dom.lobbyList().innerHTML = '<li style="color: var(--text-muted); font-size: 13px; font-style: italic;">Đang đợi người chơi kết nối...</li>';
        }
        
        // Reset HUD Elements
        document.getElementById('single-score-box').classList.remove('hidden');
        document.getElementById('multi-score-box').classList.add('hidden');
    }
    
    // --- Broadcast Helper for Host ---
    broadcast(data) {
        this.connections.forEach(c => {
            if (c.open) {
                c.send(data);
            }
        });
    }
    
    // --- Host Functions ---
    
    createRoom() {
        window.gameAudio.playClick();
        this.cleanup();
        this.isHost = true;
        this.dom.initial().classList.add('hidden');
        this.dom.host().classList.remove('hidden');
        this.dom.hostStatus().innerText = 'Đang kết nối tới server signaling...';
        
        const codeDigits = Math.floor(1000 + Math.random() * 9000);
        this.roomCode = `FS${codeDigits}`;
        this.dom.codeDisplay().innerText = this.roomCode;
        
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
            this.dom.hostStatus().innerText = 'Đang đợi người chơi tham gia...';
            this.setupCopyButton();
        });
        
        this.peer.on('connection', (connection) => {
            this.connections.push(connection);
            this.setupHostConnection(connection);
        });
        
        this.peer.on('error', (err) => {
            console.error('Host PeerJS error:', err);
            this.dom.hostStatus().innerText = `Lỗi khởi tạo phòng. Vui lòng thử lại.`;
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
    
    setupHostConnection(connection) {
        connection.on('open', () => {
            this.isActive = true;
            // Simply mark as active. We wait for client to send a 'join-request' with their name.
        });
        
        connection.on('data', (data) => {
            this.handleHostIncomingData(connection, data);
        });
        
        connection.on('close', () => {
            this.handlePlayerDisconnect(connection.peer);
        });
        
        connection.on('error', (err) => {
            console.error('Connection error on player:', connection.peer, err);
            this.handlePlayerDisconnect(connection.peer);
        });
    }
    
    handlePlayerDisconnect(peerId) {
        this.connections = this.connections.filter(c => c.peer !== peerId);
        this.players = this.players.filter(p => p.id !== peerId);
        
        // Sync new list
        this.broadcast({
            type: 'players-list',
            players: this.players
        });
        
        this.updateLobbyList();
        
        if (this.players.length === 0) {
            this.dom.startBtn().classList.add('hidden');
            this.dom.hostStatus().innerText = 'Đang đợi người chơi tham gia...';
        }
        
        if (window.gameInstance && window.gameInstance.gameState === 'PLAYING') {
            // If playing, update local scoreboard sidebar
            window.gameInstance.updateMultiplayerScoreboardHUD();
        }
    }
    
    updateLobbyList() {
        const list = this.dom.lobbyList();
        list.innerHTML = '';
        
        if (this.players.length === 0) {
            list.innerHTML = '<li style="color: var(--text-muted); font-size: 13px; font-style: italic;">Đang đợi người chơi kết nối...</li>';
            return;
        }
        
        this.players.forEach(p => {
            const li = document.createElement('li');
            li.style.color = p.color;
            li.style.fontWeight = '800';
            li.style.fontSize = '14px';
            li.style.display = 'flex';
            li.style.alignItems = 'center';
            li.innerHTML = `<span style="width:8px; height:8px; border-radius:50%; background-color:${p.color}; margin-right:8px; display:inline-block;"></span> ${p.name} (Đã sẵn sàng)`;
            list.appendChild(li);
        });
    }
    
    // --- Client Functions ---
    
    joinRoom() {
        window.gameAudio.playClick();
        const nameInput = document.getElementById('mp-player-name').value.trim();
        if (!nameInput) {
            alert('Vui lòng nhập biệt danh của bạn trước khi vào phòng!');
            return;
        }
        const codeInput = this.dom.roomInput().value.trim().toUpperCase();
        if (!codeInput || codeInput.length < 5) {
            alert('Vui lòng nhập mã phòng hợp lệ!');
            return;
        }
        
        this.cleanup();
        this.isHost = false;
        this.roomCode = codeInput;
        this.myName = nameInput;
        localStorage.setItem('fruitSlasher_lastPlayer', nameInput);
        
        this.dom.initial().classList.add('hidden');
        this.dom.client().classList.remove('hidden');
        this.dom.clientStatus().innerText = 'Đang kết nối tới phòng...';
        
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
            this.dom.clientStatus().innerText = `Đang tham gia phòng ${this.roomCode}...`;
            
            this.conn = this.peer.connect(this.roomCode, {
                reliable: true
            });
            this.setupClientConnection();
        });
        
        this.peer.on('error', (err) => {
            console.error('Client PeerJS error:', err);
            this.dom.clientStatus().innerText = `Không tìm thấy phòng ${this.roomCode} hoặc kết nối bị từ chối.`;
        });
    }
    
    setupClientConnection() {
        this.conn.on('open', () => {
            this.isActive = true;
            this.dom.clientStatus().innerText = 'Đã kết nối! Đang đợi chủ phòng bắt đầu trận đấu...';
            this.send({
                type: 'join-request',
                name: this.myName
            });
        });
        
        this.conn.on('data', (data) => {
            this.handleClientIncomingData(data);
        });
        
        this.conn.on('close', () => {
            alert('Chủ phòng đã đóng kết nối hoặc kết nối bị mất!');
            if (window.gameInstance) {
                window.gameInstance.exitToMenu();
            }
            this.cleanup();
        });
        
        this.conn.on('error', (err) => {
            console.error('Connection error:', err);
            alert('Mất kết nối với phòng!');
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
    
    // --- Data Handlers ---
    
    handleHostIncomingData(connection, data) {
        if (!data || !this.isActive) return;
        
        if (data.type === 'join-request') {
            const playerIndex = this.players.length;
            const name = data.name ? data.name.trim().substring(0, 12) : `Người chơi ${playerIndex + 1}`;
            const color = this.playerColors[playerIndex % this.playerColors.length];
            
            const playerData = {
                id: connection.peer,
                name: name,
                score: 0,
                color: color,
                swipePoints: []
            };
            
            this.players.push(playerData);
            
            // 1. Send connection setup to that specific client
            connection.send({
                type: 'setup',
                yourId: connection.peer,
                name: name,
                color: color
            });
            
            // 2. Broadcast updated player list to all connected players
            this.broadcast({
                type: 'players-list',
                players: this.players
            });
            
            // 3. Update Host UI elements
            this.updateLobbyList();
            this.dom.hostStatus().innerText = 'Người chơi đã kết nối! Nhấn Bắt đầu chơi.';
            
            // Show start button
            this.dom.startBtn().classList.remove('hidden');
            this.dom.startBtn().onclick = () => {
                window.gameAudio.playClick();
                this.dom.startBtn().classList.add('hidden');
                
                // Hide screen and trigger Host Spectator Mode
                this.dom.screen().classList.add('hidden');
                this.dom.screen().classList.remove('active');
                
                // Broadcast Start game to clients
                this.broadcast({ type: 'start-match' });
                
                if (window.gameInstance) {
                    window.gameInstance.startMultiplayerGame();
                }
            };
            return;
        }
        
        const player = this.players.find(p => p.id === connection.peer);
        if (!player) return;
        
        switch(data.type) {
            case 'swipe':
                player.swipePoints = data.points;
                break;
                
            case 'slice':
                if (window.gameInstance) {
                    window.gameInstance.verifyClientSlice(data.id, data.angle, data.hitX, data.hitY, connection.peer);
                }
                break;
        }
    }
    
    handleClientIncomingData(data) {
        if (!data || !this.isActive) return;
        
        switch(data.type) {
            case 'setup':
                this.myPeerId = data.yourId;
                this.myName = data.name;
                this.myColor = data.color;
                break;
                
            case 'players-list':
                this.players = data.players;
                if (window.gameInstance && window.gameInstance.gameState === 'PLAYING') {
                    window.gameInstance.updateMultiplayerScoreboardHUD();
                }
                break;
                
            case 'start-match':
                this.dom.screen().classList.add('hidden');
                this.dom.screen().classList.remove('active');
                if (window.gameInstance) {
                    window.gameInstance.startMultiplayerGame();
                }
                break;
                
            case 'spawn':
                if (window.gameInstance) {
                    window.gameInstance.syncSpawnFruit(data);
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
                if (window.gameInstance) {
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
        }
    }
}

// Global Singleton
const multiplayer = new MultiplayerManager();
window.gameMultiplayer = multiplayer;
