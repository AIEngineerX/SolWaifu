/**
 * Voice Controller - Premium Text-to-Speech for Degen Waifu
 * Priority order:
 * 1. ElevenLabs (if API key provided) - Best quality
 * 2. Puter.js OpenAI TTS (shimmer voice) - Natural sounding, FREE
 * 3. Web Speech API - Fallback
 */

export class VoiceController {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voice = null;
        this.isSpeaking = false;
        this.onSpeakStart = null;
        this.onSpeakEnd = null;
        this.onWordBoundary = null;

        // Audio element for ElevenLabs and Puter
        this.audio = new Audio();

        // ElevenLabs settings (user can set API key)
        this.elevenLabsKey = localStorage.getItem('elevenLabsKey') || null;
        this.elevenLabsVoiceId = '2ajXGJNYBR0iNHpS4VZb'; // Sol's custom voice
        this.useElevenLabs = false;

        // Puter.js settings - FREE OpenAI TTS
        this.usePuter = true; // Enable by default
        this.puterVoice = 'shimmer'; // Natural feminine voice (like Ani)
        this.puterReady = false;

        // Voice settings for Web Speech fallback
        this.settings = {
            rate: 0.82,
            pitch: 1.05,
            volume: 1.0
        };

        this.init();
    }

    init() {
        // Check for ElevenLabs key
        if (this.elevenLabsKey) {
            this.useElevenLabs = true;
            console.log('ElevenLabs voice enabled');
        }

        // Check if Puter.js is available (check now and retry after delay)
        this.checkPuterAvailability();
        setTimeout(() => this.checkPuterAvailability(), 1000);
        setTimeout(() => this.checkPuterAvailability(), 3000);

        // Setup Web Speech fallback
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = () => this.selectVoice();
        }
        setTimeout(() => this.selectVoice(), 100);

        // Setup audio events
        this.audio.onplay = () => {
            this.isSpeaking = true;
            if (this.onSpeakStart) this.onSpeakStart();
        };

        this.audio.onended = () => {
            this.isSpeaking = false;
            if (this.onSpeakEnd) this.onSpeakEnd();
        };

        this.audio.onerror = () => {
            this.isSpeaking = false;
            if (this.onSpeakEnd) this.onSpeakEnd();
        };
    }

    checkPuterAvailability() {
        if (this.puterReady) return; // Already ready

        if (typeof puter !== 'undefined' && puter.ai) {
            this.puterReady = true;
            console.log('Puter.js TTS ready (shimmer voice) - natural AI voice enabled!');
        }
    }

    selectVoice() {
        const voices = this.synth.getVoices();

        // Priority: Natural sounding female voices
        const preferredVoices = [
            'Microsoft Aria Online',
            'Microsoft Jenny',
            'Google US English',
            'Samantha',
            'Microsoft Zira',
            'Karen',
        ];

        for (const preferred of preferredVoices) {
            const found = voices.find(v =>
                v.name.toLowerCase().includes(preferred.toLowerCase())
            );
            if (found) {
                this.voice = found;
                console.log('Web Speech voice:', found.name);
                return;
            }
        }

        // Fallback to any English female-sounding voice
        const englishVoice = voices.find(v =>
            v.lang.startsWith('en') &&
            !v.name.toLowerCase().includes('male')
        );

        if (englishVoice) {
            this.voice = englishVoice;
        } else if (voices.length > 0) {
            this.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
        }
    }

    /**
     * Set ElevenLabs API key
     */
    setElevenLabsKey(key) {
        this.elevenLabsKey = key;
        localStorage.setItem('elevenLabsKey', key);
        this.useElevenLabs = !!key;
        console.log('ElevenLabs', key ? 'enabled' : 'disabled');
    }

    /**
     * Speak text with natural voice
     * Priority: ElevenLabs > Puter.js > Web Speech
     */
    async speak(text, options = {}) {
        // Stop any current speech
        this.stop();

        // Clean text
        const cleanText = this.cleanTextForSpeech(text);
        if (!cleanText) return;

        // Try ElevenLabs first if available (premium)
        if (this.useElevenLabs && this.elevenLabsKey) {
            try {
                await this.speakWithElevenLabs(cleanText);
                return;
            } catch (error) {
                console.warn('ElevenLabs failed:', error.message);
            }
        }

        // Try Puter.js OpenAI TTS (free, natural voice)
        if (this.usePuter && this.puterReady) {
            try {
                await this.speakWithPuter(cleanText);
                return;
            } catch (error) {
                console.warn('Puter TTS failed:', error.message);
            }
        }

        // Fallback to Web Speech
        await this.speakWithWebSpeech(cleanText, options);
    }

    /**
     * Speak using Puter.js OpenAI TTS (natural voice like Ani)
     */
    async speakWithPuter(text) {
        if (typeof puter === 'undefined' || !puter.ai) {
            throw new Error('Puter.js not available');
        }

        this.isSpeaking = true;
        if (this.onSpeakStart) this.onSpeakStart();

        try {
            // Use OpenAI TTS through Puter.js (free!)
            const audio = await puter.ai.txt2speech(text, {
                voice: this.puterVoice, // 'shimmer' - natural feminine voice
                model: 'tts-1', // Standard quality (faster)
                speed: 0.95, // Slightly slower for sensual feel
                instructions: 'Speak in a warm, friendly, slightly playful and intimate tone. Sound natural and expressive like a real person.'
            });

            // Play the audio
            return new Promise((resolve) => {
                audio.onended = () => {
                    this.isSpeaking = false;
                    if (this.onSpeakEnd) this.onSpeakEnd();
                    resolve();
                };
                audio.onerror = () => {
                    this.isSpeaking = false;
                    if (this.onSpeakEnd) this.onSpeakEnd();
                    resolve();
                };
                audio.play();
            });
        } catch (error) {
            this.isSpeaking = false;
            if (this.onSpeakEnd) this.onSpeakEnd();
            throw error;
        }
    }

    /**
     * Speak using ElevenLabs API (premium natural voice)
     */
    async speakWithElevenLabs(text) {
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${this.elevenLabsVoiceId}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': this.elevenLabsKey
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_turbo_v2_5',
                    voice_settings: {
                        stability: 0.30,
                        similarity_boost: 0.80,
                        style: 0.75,
                        use_speaker_boost: true,
                        speaking_rate: 0.85
                    }
                })
            }
        );

        if (!response.ok) {
            throw new Error(`ElevenLabs error: ${response.status}`);
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);

        return new Promise((resolve) => {
            this.audio.src = audioUrl;
            this.audio.onended = () => {
                URL.revokeObjectURL(audioUrl);
                this.isSpeaking = false;
                if (this.onSpeakEnd) this.onSpeakEnd();
                resolve();
            };
            this.audio.play();
        });
    }

    /**
     * Speak using Web Speech API (fallback)
     */
    speakWithWebSpeech(text, options = {}) {
        return new Promise((resolve) => {
            const utterance = new SpeechSynthesisUtterance(text);

            if (this.voice) {
                utterance.voice = this.voice;
            }

            utterance.rate = options.rate || this.settings.rate;
            utterance.pitch = options.pitch || this.settings.pitch;
            utterance.volume = options.volume || this.settings.volume;

            utterance.onstart = () => {
                this.isSpeaking = true;
                if (this.onSpeakStart) this.onSpeakStart();
            };

            utterance.onend = () => {
                this.isSpeaking = false;
                if (this.onSpeakEnd) this.onSpeakEnd();
                resolve();
            };

            utterance.onerror = () => {
                this.isSpeaking = false;
                if (this.onSpeakEnd) this.onSpeakEnd();
                resolve();
            };

            utterance.onboundary = (event) => {
                if (event.name === 'word' && this.onWordBoundary) {
                    this.onWordBoundary(event);
                }
            };

            this.synth.speak(utterance);
        });
    }

    /**
     * Clean text for speech synthesis
     */
    cleanTextForSpeech(text) {
        return text
            // Remove emojis
            .replace(/[\u{1F600}-\u{1F64F}]/gu, '')
            .replace(/[\u{1F300}-\u{1F5FF}]/gu, '')
            .replace(/[\u{1F680}-\u{1F6FF}]/gu, '')
            .replace(/[\u{1F1E0}-\u{1F1FF}]/gu, '')
            .replace(/[\u{2600}-\u{26FF}]/gu, '')
            .replace(/[\u{2700}-\u{27BF}]/gu, '')
            .replace(/[\u{FE00}-\u{FE0F}]/gu, '')
            .replace(/[\u{1F900}-\u{1F9FF}]/gu, '')
            // Convert degen slang to speakable words
            .replace(/\bgm\b/gi, 'good morning')
            .replace(/\blfg\b/gi, "let's go")
            .replace(/\bwagmi\b/gi, "we're all gonna make it")
            .replace(/\bngmi\b/gi, 'not gonna make it')
            .replace(/\bnfa\b/gi, 'not financial advice')
            .replace(/\biykyk\b/gi, 'if you know you know')
            .replace(/\bser\b/gi, 'sir')
            .replace(/\banon\b/gi, 'anon')
            .replace(/\bsmol\b/gi, 'small')
            .replace(/\bwen\b/gi, 'when')
            .replace(/\bdis\b/gi, 'this')
            .replace(/\bfren\b/gi, 'friend')
            .replace(/\btbh\b/gi, 'to be honest')
            .replace(/\bngl\b/gi, 'not gonna lie')
            .replace(/\brn\b/gi, 'right now')
            .replace(/\bur\b/gi, 'your')
            .replace(/\bomg\b/gi, 'oh my god')
            .replace(/\blmao\b/gi, '')
            .replace(/\blol\b/gi, '')
            // Clean formatting
            .replace(/~/g, '')
            .replace(/\*+/g, '')
            .replace(/`+/g, '')
            .replace(/\.{3,}/g, '...')
            // Clean whitespace
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Stop speaking
     */
    stop() {
        if (this.synth.speaking) {
            this.synth.cancel();
        }
        if (!this.audio.paused) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        this.isSpeaking = false;
    }

    /**
     * Check if currently speaking
     */
    get speaking() {
        return this.isSpeaking || this.synth.speaking || !this.audio.paused;
    }

    /**
     * Get available Web Speech voices
     */
    getVoices() {
        return this.synth.getVoices().filter(v => v.lang.startsWith('en'));
    }

    /**
     * Set Puter voice (shimmer, alloy, echo, fable, onyx, nova)
     */
    setPuterVoice(voice) {
        this.puterVoice = voice;
        console.log('Puter voice set to:', voice);
    }

    /**
     * Enable/disable Puter TTS
     */
    setPuterEnabled(enabled) {
        this.usePuter = enabled;
        console.log('Puter TTS', enabled ? 'enabled' : 'disabled');
    }

    /**
     * Set Web Speech voice by name
     */
    setVoice(voiceName) {
        const voices = this.synth.getVoices();
        const voice = voices.find(v => v.name === voiceName);
        if (voice) {
            this.voice = voice;
            console.log('Voice changed to:', voice.name);
        }
    }

    /**
     * Update voice settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }
}
