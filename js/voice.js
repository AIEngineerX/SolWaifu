/**
 * Voice Controller - Text-to-Speech for Degen Waifu
 * Uses Web Speech API with anime-style voice settings
 */

export class VoiceController {
    constructor() {
        this.synth = window.speechSynthesis;
        this.voice = null;
        this.isSpeaking = false;
        this.onSpeakStart = null;
        this.onSpeakEnd = null;
        this.onWordBoundary = null;

        // Voice settings for anime waifu vibe
        this.settings = {
            rate: 1.05,      // Slightly faster for energy
            pitch: 1.3,      // Higher pitch for cute voice
            volume: 1.0
        };

        this.init();
    }

    init() {
        // Wait for voices to load
        if (this.synth.onvoiceschanged !== undefined) {
            this.synth.onvoiceschanged = () => this.selectVoice();
        }

        // Try to select voice immediately (some browsers)
        setTimeout(() => this.selectVoice(), 100);
    }

    selectVoice() {
        const voices = this.synth.getVoices();

        // Priority list of female/anime-sounding voices
        const preferredVoices = [
            'Microsoft Zira',      // Windows - female
            'Microsoft Aria',      // Windows 11 - natural female
            'Samantha',            // macOS - female
            'Karen',               // macOS - Australian female
            'Moira',               // macOS - Irish female
            'Google US English',   // Chrome - clear female
            'Google UK English Female',
            'female',              // Generic match
            'woman'
        ];

        // Try to find a preferred voice
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

        // Fallback: find any English female voice
        const englishVoice = voices.find(v =>
            v.lang.startsWith('en') &&
            (v.name.toLowerCase().includes('female') ||
             v.name.toLowerCase().includes('woman') ||
             !v.name.toLowerCase().includes('male'))
        );

        if (englishVoice) {
            this.voice = englishVoice;
            console.log('🎤 Selected voice:', englishVoice.name);
        } else if (voices.length > 0) {
            // Last resort: just use the first English voice
            this.voice = voices.find(v => v.lang.startsWith('en')) || voices[0];
            console.log('🎤 Fallback voice:', this.voice?.name);
        }
    }

    /**
     * Speak text with callbacks for animation sync
     */
    speak(text, options = {}) {
        return new Promise((resolve) => {
            // Cancel any ongoing speech
            this.stop();

            // Clean text for speech (remove emojis, special chars)
            const cleanText = this.cleanTextForSpeech(text);

            if (!cleanText) {
                resolve();
                return;
            }

            const utterance = new SpeechSynthesisUtterance(cleanText);

            // Apply voice and settings
            if (this.voice) {
                utterance.voice = this.voice;
            }
            utterance.rate = options.rate || this.settings.rate;
            utterance.pitch = options.pitch || this.settings.pitch;
            utterance.volume = options.volume || this.settings.volume;

            // Event handlers
            utterance.onstart = () => {
                this.isSpeaking = true;
                if (this.onSpeakStart) this.onSpeakStart();
            };

            utterance.onend = () => {
                this.isSpeaking = false;
                if (this.onSpeakEnd) this.onSpeakEnd();
                resolve();
            };

            utterance.onerror = (event) => {
                console.warn('Speech error:', event.error);
                this.isSpeaking = false;
                if (this.onSpeakEnd) this.onSpeakEnd();
                resolve();
            };

            // Word boundary for lip sync
            utterance.onboundary = (event) => {
                if (event.name === 'word' && this.onWordBoundary) {
                    this.onWordBoundary(event);
                }
            };

            // Speak!
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
            // Convert crypto slang to speakable
            .replace(/\bgm\b/gi, 'good morning')
            .replace(/\blfg\b/gi, 'lets fucking go')
            .replace(/\bwagmi\b/gi, 'we are gonna make it')
            .replace(/\bngmi\b/gi, 'not gonna make it')
            .replace(/\bnfa\b/gi, 'not financial advice')
            .replace(/\biykyk\b/gi, 'if you know you know')
            .replace(/\bser\b/gi, 'sir')
            .replace(/\banon\b/gi, 'anon')
            .replace(/\bsmol\b/gi, 'small')
            .replace(/\bwen\b/gi, 'when')
            .replace(/\bdis\b/gi, 'this')
            .replace(/\bfren\b/gi, 'friend')
            .replace(/\bbullish af\b/gi, 'super bullish')
            .replace(/\bbearish tbh\b/gi, 'bearish to be honest')
            // Clean up tildes and special formatting
            .replace(/~/g, '')
            .replace(/\*+/g, '')
            .replace(/`+/g, '')
            // Clean extra whitespace
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
        this.isSpeaking = false;
    }

    /**
     * Check if currently speaking
     */
    get speaking() {
        return this.isSpeaking || this.synth.speaking;
    }

    /**
     * Get available voices (for settings UI)
     */
    getVoices() {
        return this.synth.getVoices().filter(v => v.lang.startsWith('en'));
    }

    /**
     * Set voice by name
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
