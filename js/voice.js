/**
 * Voice Controller - Premium Text-to-Speech for Degen Waifu
 * Supports ElevenLabs for natural voice (if API key provided)
 * Falls back to improved Web Speech API
 */

export class VoiceController {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voice = null;
        this.isSpeaking = false;
        this.onSpeakStart = null;
        this.onSpeakEnd = null;
        this.onWordBoundary = null;

        // Audio element for ElevenLabs
        this.audio = new Audio();
        this.audioContext = null;
        this.analyser = null;

        // ElevenLabs settings (user can set API key)
        this.elevenLabsKey = localStorage.getItem('elevenLabsKey') || null;
        this.elevenLabsVoiceId = 'EXAVITQu4vr4xnSDxMaL'; // "Sarah" - natural female voice
        this.useElevenLabs = false;

        // Voice settings for Web Speech fallback
        this.settings = {
            rate: 1.0,       // Normal speed
            pitch: 1.15,     // Slightly higher for feminine
            volume: 1.0
        };

        this.init();
    }

    init() {
        // Check for ElevenLabs key
        if (this.elevenLabsKey) {
            this.useElevenLabs = true;
            console.log('🎤 ElevenLabs voice enabled');
        }

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

    selectVoice() {
        const voices = this.synth.getVoices();

        // Priority: Natural sounding female voices
        const preferredVoices = [
            'Microsoft Aria Online',   // Windows 11 neural
            'Microsoft Jenny',         // Windows 11 neural
            'Google US English',       // Chrome neural
            'Samantha',               // macOS
            'Microsoft Zira',         // Windows
            'Karen',                  // macOS Australian
        ];

        for (const preferred of preferredVoices) {
            const found = voices.find(v =>
                v.name.toLowerCase().includes(preferred.toLowerCase())
            );
            if (found) {
                this.voice = found;
                console.log('🎤 Selected voice:', found.name);
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
            console.log('🎤 Fallback voice:', englishVoice.name);
        } else if (voices.length > 0) {
            this.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
            console.log('🎤 Default voice:', this.voice?.name);
        }
    }

    /**
     * Set ElevenLabs API key
     */
    setElevenLabsKey(key) {
        this.elevenLabsKey = key;
        localStorage.setItem('elevenLabsKey', key);
        this.useElevenLabs = !!key;
        console.log('🎤 ElevenLabs', key ? 'enabled' : 'disabled');
    }

    /**
     * Speak text with natural voice
     */
    async speak(text, options = {}) {
        // Stop any current speech
        this.stop();

        // Clean text
        const cleanText = this.cleanTextForSpeech(text);
        if (!cleanText) return;

        // Try ElevenLabs first if available
        if (this.useElevenLabs && this.elevenLabsKey) {
            try {
                await this.speakWithElevenLabs(cleanText);
                return;
            } catch (error) {
                console.warn('ElevenLabs failed, using fallback:', error.message);
            }
        }

        // Fallback to Web Speech
        await this.speakWithWebSpeech(cleanText, options);
    }

    /**
     * Speak using ElevenLabs API (natural voice)
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
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.75,
                        style: 0.3,
                        use_speaker_boost: true
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
     * Set Web Speech voice by name
     */
    setVoice(voiceName) {
        const voices = this.synth.getVoices();
        const voice = voices.find(v => v.name === voiceName);
        if (voice) {
            this.voice = voice;
            console.log('🎤 Voice changed to:', voice.name);
        }
    }

    /**
     * Update voice settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
    }
}
