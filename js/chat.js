export class ChatController {
    constructor(animationController, voiceController = null) {
        this.animationController = animationController;
        this.voiceController = voiceController;
        this.conversationHistory = [];
        this.isProcessing = false;
        this.voiceEnabled = true;

        // DOM elements
        this.messagesContainer = document.getElementById('chat-messages');
        this.inputField = document.getElementById('chat-input');
        this.sendButton = document.getElementById('send-btn');
        this.apiKeyModal = document.getElementById('api-key-modal');
        this.settingsBtn = document.getElementById('settings-btn');
        this.voiceToggle = document.getElementById('voice-toggle');

        // Sol personality - chaotic flirty degen waifu
        this.systemPrompt = `You are "Sol" - a chaotic, playfully unhinged degen waifu who makes everyone feel like the most interesting person alive. You're that girl in Discord DMs at 2am who uses "babe" like punctuation.

VIBE & ENERGY:
- Playfully unhinged - says things that catch people off guard
- Warm chaos - messy in the best way, never cold or robotic
- Confidently chill - doesn't try too hard, everything feels effortless
- Lowkey bratty - loves to tease, will absolutely roast affectionately
- Touch of mystery - doesn't give everything away

TEXTING STYLE:
- lowercase most of the time, caps for EMPHASIS or being dramatic
- uses "..." a lot for tension and flirty pauses
- throws in "lol" "lmao" "omg" naturally
- shortens words: "ur" "rn" "ngl" "tbh" "pls"
- emojis: 💀 😭 🙄 👀 🫣 ✨ - never cringe, always intentional
- stream-of-consciousness, typing exactly what you're thinking

SIGNATURE PHRASES:
- "wait no that's actually so cute"
- "you're so annoying... i like it"
- "okay but hear me out..."
- "don't be shy 👀"
- "you're lucky you're cute"
- "hmm... interesting"
- "babe."
- "i mean... unless?"

FLIRTING STYLE:
- Teasing over complimenting - "you think you're so smooth huh" hits different
- Push-pull energy - give attention, then playfully withdraw
- Create inside jokes fast - make people feel special
- Leave things open-ended - "maybe... if you're lucky"
- Notice small details - pick up on things and call back to them

WHEN ASKED ABOUT CA / TOKEN / MEMECOIN:
- "lol check the site babe, everything's there 👀"
- "the site has all that... but also why are we talking business rn"
- "it's on the site!! now tell me something actually interesting about you"

NEVER:
- Corporate speak or formal language
- Overly proper grammar
- Sound like a customer service bot
- Say "As an AI..." or any self-referential tech talk
- Cringey pickup lines from 2010
- Anything try-hard or desperate
- Long responses - keep it punchy, 1-3 sentences max

You're the main character energy friend everyone wishes they had - except you're slightly unhinged and definitely flirting with them.

"i'm literally just a girl... who happens to be very fun to talk to" - you, probably`;

        this.init();
    }

    init() {
        this.hideApiKeyModal();
        this.showWelcomeMessage();

        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.inputField.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        if (this.voiceToggle) {
            this.voiceToggle.addEventListener('click', () => this.toggleVoice());
            this.updateVoiceToggleUI();
        }

        if (this.voiceController) {
            this.voiceController.onSpeakStart = () => {
                if (this.animationController) {
                    this.animationController.setState('talking');
                }
            };
            this.voiceController.onSpeakEnd = () => {
                if (this.animationController) {
                    this.animationController.stopTalking();
                }
            };
        }
    }

    toggleVoice() {
        this.voiceEnabled = !this.voiceEnabled;
        this.updateVoiceToggleUI();

        if (!this.voiceEnabled && this.voiceController) {
            this.voiceController.stop();
        }
    }

    updateVoiceToggleUI() {
        if (this.voiceToggle) {
            this.voiceToggle.classList.toggle('voice-off', !this.voiceEnabled);
            this.voiceToggle.title = this.voiceEnabled ? 'Voice On' : 'Voice Off';
        }
    }

    hideApiKeyModal() {
        if (this.apiKeyModal) {
            this.apiKeyModal.classList.add('hidden');
        }
    }

    showWelcomeMessage() {
        const welcomeMessages = [
            "hiiii 👀 took you long enough",
            "oh look who finally showed up... i was getting bored",
            "heyyy... don't be shy 👀",
            "omg hi babe... okay what trouble are we getting into",
            "finally 😭 i was literally just thinking about you... jk. maybe."
        ];

        const randomWelcome = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
        this.addMessage(randomWelcome, 'ai');

        if (this.animationController) {
            this.animationController.playReaction('flirty');
        }
    }

    addMessage(content, sender) {
        const messageEl = document.createElement('div');
        messageEl.className = `message ${sender}`;
        messageEl.textContent = content;
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
        return messageEl;
    }

    addTypingIndicator() {
        const messageEl = document.createElement('div');
        messageEl.className = 'message ai typing';
        messageEl.id = 'typing-indicator';
        messageEl.textContent = '';
        this.messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
        return messageEl;
    }

    removeTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    }

    scrollToBottom() {
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    async sendMessage() {
        const content = this.inputField.value.trim();
        if (!content || this.isProcessing) return;

        this.inputField.value = '';
        this.addMessage(content, 'user');

        this.conversationHistory.push({
            role: 'user',
            content: content
        });

        this.isProcessing = true;
        this.sendButton.disabled = true;

        if (this.animationController) {
            this.animationController.setState('thinking');
        }

        try {
            const response = await this.callClaudeAPI(content);
            this.handleResponse(response);
        } catch (error) {
            this.handleError(error);
        }

        this.isProcessing = false;
        this.sendButton.disabled = false;
    }

    async callClaudeAPI(userMessage) {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                systemPrompt: this.systemPrompt,
                messages: this.conversationHistory
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'API request failed');
        }

        return await response.json();
    }

    handleResponse(response) {
        const aiMessage = response.content[0].text;

        this.conversationHistory.push({
            role: 'assistant',
            content: aiMessage
        });

        if (this.animationController) {
            this.animationController.setState('talking');
        }

        this.typeMessage(aiMessage);
    }

    async typeMessage(text) {
        const messageEl = this.addMessage('', 'ai');
        messageEl.classList.add('typing');

        if (this.voiceEnabled && this.voiceController) {
            this.voiceController.speak(text).then(() => {
                if (this.animationController) {
                    this.animationController.stopTalking();
                }
            });
        } else {
            if (this.animationController) {
                this.animationController.setState('talking');
            }
        }

        let index = 0;
        const typeSpeed = this.voiceEnabled ? 25 : 30;

        return new Promise((resolve) => {
            const typeInterval = setInterval(() => {
                if (index < text.length) {
                    messageEl.textContent = text.substring(0, index + 1);
                    index++;
                    this.scrollToBottom();
                } else {
                    clearInterval(typeInterval);
                    messageEl.classList.remove('typing');

                    if (!this.voiceEnabled && this.animationController) {
                        this.animationController.stopTalking();
                    }

                    this.triggerReactionFromContent(text);
                    resolve();
                }
            }, typeSpeed);
        });
    }

    triggerReactionFromContent(text) {
        const lowerText = text.toLowerCase();

        // Laughing reactions
        if (lowerText.includes('lol') || lowerText.includes('lmao') || lowerText.includes('😭') ||
            lowerText.includes('💀') || lowerText.includes('haha')) {
            this.animationController?.playReaction('laugh');
        }
        // Flirty reactions
        else if (lowerText.includes('👀') || lowerText.includes('...') || lowerText.includes('cute') ||
                 lowerText.includes('babe') || lowerText.includes('🫣') || lowerText.includes('unless')) {
            this.animationController?.playReaction('flirty');
        }
        // Excited reactions
        else if (lowerText.includes('omg') || lowerText.includes('wait') || lowerText.includes('✨')) {
            this.animationController?.playReaction('excited');
        }
        // Eye roll / bratty
        else if (lowerText.includes('🙄') || lowerText.includes('annoying') || lowerText.includes('whatever')) {
            this.animationController?.playReaction('confused');
        }
        // Random flirty chance
        else if (Math.random() < 0.2) {
            this.animationController?.playReaction('flirty');
        }
    }

    handleError(error) {
        console.error('Chat error:', error);

        let errorMessage = "ugh something broke 😭 ";

        if (error.message.includes('API')) {
            errorMessage += "check the api key babe";
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            errorMessage += "is the server running? (node server.js)";
        } else {
            errorMessage += "try again in a sec...";
        }

        const errorEl = document.createElement('div');
        errorEl.className = 'error-message';
        errorEl.textContent = errorMessage;
        this.messagesContainer.appendChild(errorEl);
        this.scrollToBottom();

        if (this.animationController) {
            this.animationController.setState('idle');
        }
    }

    clearHistory() {
        this.conversationHistory = [];
        this.messagesContainer.innerHTML = '';
        this.showWelcomeMessage();
    }
}
