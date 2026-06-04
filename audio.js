class SoundEffects {
    constructor() {
        this.ctx = null;
        this.enabled = localStorage.getItem('fruitSlasher_audio') !== 'false';
        this.bgmInterval = null;
        this.bgmNode = null;
        this.fuseNode = null;
        this.fuseGain = null;
    }

    init() {
        if (this.ctx) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContextClass();
    }

    resume() {
        this.init();
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    toggle() {
        this.enabled = !this.enabled;
        localStorage.setItem('fruitSlasher_audio', this.enabled);
        if (!this.enabled) {
            this.stopBGM();
            this.stopFuseSizzle();
        } else {
            this.resume();
        }
        return this.enabled;
    }

    // Dynamic Swoosh (based on swipe speed)
    playSwoosh(speed = 1) {
        if (!this.enabled) return;
        this.resume();

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();
        
        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        const duration = 0.15 + (0.1 / speed);
        const pitchStart = 400 + (speed * 100);
        const pitchEnd = 80;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(pitchStart, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(pitchEnd, this.ctx.currentTime + duration);

        gainNode.gain.setValueAtTime(0.01, this.ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.25, this.ctx.currentTime + 0.03);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // Splat/Squish (Juicy slice sound)
    playSplat(type = 'default') {
        if (!this.enabled) return;
        this.resume();

        const time = this.ctx.currentTime;
        
        // 1. Meat Thud (Low frequency pop)
        const lowOsc = this.ctx.createOscillator();
        const lowGain = this.ctx.createGain();
        lowOsc.connect(lowGain);
        lowGain.connect(this.ctx.destination);

        lowOsc.frequency.setValueAtTime(150, time);
        lowOsc.frequency.exponentialRampToValueAtTime(30, time + 0.12);

        lowGain.gain.setValueAtTime(0.3, time);
        lowGain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);

        lowOsc.start(time);
        lowOsc.stop(time + 0.15);

        // 2. High Squish (High frequency noise burst)
        const bufferSize = this.ctx.sampleRate * 0.1;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(1000, time);
        filter.frequency.exponentialRampToValueAtTime(200, time + 0.08);
        filter.Q.value = 5;

        const noiseGain = this.ctx.createGain();
        
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        noiseGain.gain.setValueAtTime(0.2, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.1);

        noise.start(time);
        noise.stop(time + 0.1);

        // 3. Optional Powerup Splat
        if (type === 'freeze') {
            this.playPowerupChime(1500, 2500);
        } else if (type === 'frenzy') {
            this.playPowerupChime(1000, 2000);
        } else if (type === 'double') {
            this.playPowerupChime(800, 1800);
        }
    }

    playPowerupChime(startFreq, endFreq) {
        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(startFreq, time);
        osc.frequency.exponentialRampToValueAtTime(endFreq, time + 0.3);

        gain.gain.setValueAtTime(0.15, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.4);

        osc.start(time);
        osc.stop(time + 0.4);
    }

    // Bomb Sizzle (white noise with high bandpass filter & amplitude modulation)
    startFuseSizzle() {
        if (!this.enabled || this.fuseNode) return;
        this.resume();

        const time = this.ctx.currentTime;
        const bufferSize = this.ctx.sampleRate * 2; // 2 seconds of noise loop
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        this.fuseNode = this.ctx.createBufferSource();
        this.fuseNode.buffer = buffer;
        this.fuseNode.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(8000, time);
        filter.Q.value = 8;

        this.fuseGain = this.ctx.createGain();
        this.fuseGain.gain.setValueAtTime(0.04, time);

        // Modulator for crackling fuse effect
        const mod = this.ctx.createOscillator();
        mod.frequency.value = 25; // 25Hz crackle modulation
        const modGain = this.ctx.createGain();
        modGain.gain.value = 0.02;

        mod.connect(modGain);
        modGain.connect(this.fuseGain.gain);

        this.fuseNode.connect(filter);
        filter.connect(this.fuseGain);
        this.fuseGain.connect(this.ctx.destination);

        mod.start(time);
        this.fuseNode.start(time);
    }

    stopFuseSizzle() {
        if (this.fuseNode) {
            try {
                this.fuseNode.stop();
            } catch (e) {}
            this.fuseNode = null;
            this.fuseGain = null;
        }
    }

    // Bomb Explosion (Deep sub-bass + noise blast + ringing filter)
    playExplosion() {
        if (!this.enabled) return;
        this.resume();
        this.stopFuseSizzle();

        const time = this.ctx.currentTime;

        // 1. Deep Bass Boom
        const boomOsc = this.ctx.createOscillator();
        const boomGain = this.ctx.createGain();
        boomOsc.connect(boomGain);
        boomGain.connect(this.ctx.destination);

        boomOsc.frequency.setValueAtTime(160, time);
        boomOsc.frequency.exponentialRampToValueAtTime(10, time + 0.8);

        boomGain.gain.setValueAtTime(0.8, time);
        boomGain.gain.exponentialRampToValueAtTime(0.001, time + 1.0);

        boomOsc.start(time);
        boomOsc.stop(time + 1.0);

        // 2. White Noise Blast
        const bufferSize = this.ctx.sampleRate * 0.8;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, time);
        filter.frequency.exponentialRampToValueAtTime(80, time + 0.6);

        const noiseGain = this.ctx.createGain();
        
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.ctx.destination);

        noiseGain.gain.setValueAtTime(0.6, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.8);

        noise.start(time);
        noise.stop(time + 0.8);
    }

    // Combo chime arpeggio
    playCombo(count = 3) {
        if (!this.enabled) return;
        this.resume();

        const time = this.ctx.currentTime;
        const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99]; // C E G C E G
        const countPlay = Math.min(count, notes.length);

        for (let i = 0; i < countPlay; i++) {
            const noteTime = time + (i * 0.08);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'sine';
            osc.frequency.setValueAtTime(notes[i], noteTime);

            gain.gain.setValueAtTime(0.0, noteTime);
            gain.gain.linearRampToValueAtTime(0.12, noteTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);

            osc.start(noteTime);
            osc.stop(noteTime + 0.3);
        }
    }

    // UI Click feedback
    playClick() {
        if (!this.enabled) return;
        this.resume();

        const time = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, time);
        osc.frequency.exponentialRampToValueAtTime(300, time + 0.05);

        gain.gain.setValueAtTime(0.08, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.06);

        osc.start(time);
        osc.stop(time + 0.06);
    }

    // Game Over synth chime sequence
    playGameOverChime() {
        if (!this.enabled) return;
        this.resume();

        const time = this.ctx.currentTime;
        const notes = [392.00, 349.23, 311.13, 246.94]; // G4, F4, Eb4, B3 (sad progression)

        for (let i = 0; i < notes.length; i++) {
            const noteTime = time + (i * 0.2);
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(notes[i], noteTime);

            gain.gain.setValueAtTime(0.0, noteTime);
            gain.gain.linearRampToValueAtTime(0.15, noteTime + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.45);

            osc.start(noteTime);
            osc.stop(noteTime + 0.5);
        }
    }

    // Simple Background Music (Subtle bass + arpeggio synth loop)
    startBGM() {
        if (!this.enabled) return;
        this.resume();
        this.stopBGM();

        let step = 0;
        // Simple rhythmic bass pattern (in A minor)
        const bassNotes = [110, 110, 130.81, 130.81, 146.83, 146.83, 164.81, 196.00]; // A2, C3, D3, E3, G3
        
        const tick = () => {
            if (!this.enabled) return;
            const time = this.ctx.currentTime;
            
            // Bass beat
            const bassOsc = this.ctx.createOscillator();
            const bassGain = this.ctx.createGain();
            bassOsc.connect(bassGain);
            bassGain.connect(this.ctx.destination);

            bassOsc.type = 'sine';
            const note = bassNotes[step % bassNotes.length];
            bassOsc.frequency.setValueAtTime(note, time);

            bassGain.gain.setValueAtTime(0.05, time);
            bassGain.gain.exponentialRampToValueAtTime(0.001, time + 0.25);

            bassOsc.start(time);
            bassOsc.stop(time + 0.3);

            // Light synth tick on subdivisions
            if (step % 2 === 0) {
                const tickOsc = this.ctx.createOscillator();
                const tickGain = this.ctx.createGain();
                tickOsc.connect(tickGain);
                tickGain.connect(this.ctx.destination);
                
                tickOsc.type = 'triangle';
                tickOsc.frequency.setValueAtTime(note * 4, time); // two octaves up

                tickGain.gain.setValueAtTime(0.015, time);
                tickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.08);

                tickOsc.start(time);
                tickOsc.stop(time + 0.1);
            }

            step++;
        };

        // Trigger tick every 350ms (around 170 BPM eighth notes)
        this.bgmInterval = setInterval(tick, 350);
    }

    stopBGM() {
        if (this.bgmInterval) {
            clearInterval(this.bgmInterval);
            this.bgmInterval = null;
        }
    }
}

// Global Singleton
const audio = new SoundEffects();
window.gameAudio = audio;
