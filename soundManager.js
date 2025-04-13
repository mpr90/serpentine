/**
 * SoundManager class for handling game audio
 * Provides methods for loading, playing, and managing sound effects
 */
class SoundManager {
    constructor() {
        // Audio context for generating and playing sounds
        this.audioContext = null;
        
        // Sound buffers for pre-loaded audio files
        this.soundBuffers = {};
        
        // Volume control (0.0 to 1.0)
        this.volume = 0.5;
        
        // Mute state
        this.isMuted = false;
        
        // Initialize the audio context
        this.initAudioContext();
    }
    
    /**
     * Initialize the Web Audio API context
     * This must be called after a user interaction due to browser autoplay policies
     */
    initAudioContext() {
        try {
            // Create audio context
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
            
            console.log("Audio context initialized successfully");
        } catch (error) {
            console.error("Web Audio API is not supported in this browser:", error);
        }
    }
    
    /**
     * Resume the audio context (must be called after user interaction)
     */
    resumeAudioContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            this.audioContext.resume().then(() => {
                console.log("Audio context resumed");
            });
        }
    }
    
    /**
     * Load an audio file and store it in the sound buffers
     * @param {string} name - Name to reference the sound
     * @param {string} url - URL of the audio file
     * @returns {Promise} - Promise that resolves when the sound is loaded
     */
    loadSound(name, url) {
        return new Promise((resolve, reject) => {
            if (!this.audioContext) {
                reject(new Error("Audio context not initialized"));
                return;
            }
            
            const request = new XMLHttpRequest();
            request.open('GET', url, true);
            request.responseType = 'arraybuffer';
            
            request.onload = () => {
                this.audioContext.decodeAudioData(
                    request.response,
                    (buffer) => {
                        this.soundBuffers[name] = buffer;
                        console.log(`Sound loaded: ${name}`);
                        resolve(buffer);
                    },
                    (error) => {
                        console.error(`Error decoding audio data for ${name}:`, error);
                        reject(error);
                    }
                );
            };
            
            request.onerror = (error) => {
                console.error(`Error loading sound ${name}:`, error);
                reject(error);
            };
            
            request.send();
        });
    }
    
    /**
     * Play a pre-loaded sound
     * @param {string} name - Name of the sound to play
     * @param {Object} options - Optional parameters for the sound
     * @param {number} options.volume - Volume level (0.0 to 1.0)
     * @param {number} options.playbackRate - Playback rate (1.0 is normal)
     */
    playSound(name, options = {}) {
        if (this.isMuted || !this.audioContext) {
            return;
        }
        
        const buffer = this.soundBuffers[name];
        if (!buffer) {
            console.warn(`Sound not found: ${name}`);
            return;
        }
        
        // Create source node
        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        
        // Create gain node for volume control
        const gainNode = this.audioContext.createGain();
        
        // Set volume (combine global volume with sound-specific volume)
        const volume = this.volume * (options.volume || 1.0);
        gainNode.gain.value = volume;
        
        // Set playback rate if specified
        if (options.playbackRate) {
            source.playbackRate.value = options.playbackRate;
        }
        
        // Connect nodes
        source.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Play the sound
        source.start(0);
        
        // Clean up when done
        source.onended = () => {
            source.disconnect();
            gainNode.disconnect();
        };
    }
    
    /**
     * Generate and play a simple 8-bit chirp sound
     * @param {Object} options - Optional parameters for the sound
     * @param {number} options.frequency - Starting frequency in Hz
     * @param {number} options.duration - Duration in seconds
     * @param {number} options.volume - Volume level (0.0 to 1.0)
     */
    playChirpSound(options = {}) {
        if (this.isMuted || !this.audioContext) {
            return;
        }
        
        // Default options
        const frequency = options.frequency || 440; // A4 note
        const duration = options.duration || 0.1; // 100ms
        const volume = this.volume * (options.volume || 1.0);
        
        // Create oscillator for the sound
        const oscillator = this.audioContext.createOscillator();
        
        // Create gain node for volume control
        const gainNode = this.audioContext.createGain();
        
        // Set up oscillator
        oscillator.type = 'square'; // Square wave for 8-bit sound
        oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
        oscillator.frequency.linearRampToValueAtTime(
            frequency * 1.5, // Rise to 1.5x frequency
            this.audioContext.currentTime + duration
        );
        
        // Set up gain envelope
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 0.01);
        gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);
        
        // Connect nodes
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        // Play the sound
        oscillator.start();
        oscillator.stop(this.audioContext.currentTime + duration);
        
        // Clean up when done
        oscillator.onended = () => {
            oscillator.disconnect();
            gainNode.disconnect();
        };
    }
    
    /**
     * Set the global volume level
     * @param {number} volume - Volume level (0.0 to 1.0)
     */
    setVolume(volume) {
        this.volume = Math.max(0, Math.min(1, volume));
    }
    
    /**
     * Toggle mute state
     * @returns {boolean} - New mute state
     */
    toggleMute() {
        this.isMuted = !this.isMuted;
        return this.isMuted;
    }
    
    /**
     * Set mute state
     * @param {boolean} muted - Whether to mute sounds
     */
    setMuted(muted) {
        this.isMuted = muted;
    }
} 