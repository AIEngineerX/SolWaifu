# $SOL - Degen Waifu AI

3d anime waifu that talks back. shes chaotic, flirty, and slightly unhinged. built for memecoins.

## wtf is this

its Sol - ur degen waifu. shes a 3d avatar powered by claude that actually has personality. not some boring chatbot, shes the girl in ur discord dms at 2am.

features:
- 3d vrm avatar with animations
- ai chat (actually good, not cringe)
- text to speech
- live dexscreener chart embed
- copy CA button
- social links (X)

## setup

1. get a vrm model from vroid hub
2. drop it in `models/` folder
3. edit the config in index.html (CA, socials, etc)
4. run `npx serve` or whatever local server
5. add ur anthropic api key when it asks

## config

edit this part in index.html:

```js
window.TOKEN_CONFIG = {
    CA: 'YOUR_CONTRACT_ADDRESS',
    TWITTER: 'https://x.com/YOUR_HANDLE',
    DEXSCREENER: 'https://dexscreener.com/solana/YOUR_CA',
    DEXSCREENER_EMBED: 'https://dexscreener.com/solana/YOUR_CA?embed=1&theme=dark',
    BUY_LINK: 'https://jup.ag/swap/SOL-YOUR_CA'
};
```

## folder structure

```
anime-ai-agent/
├── index.html        # main page + token config
├── css/
│   └── style.css     # styling
├── js/
│   ├── main.js       # app init
│   ├── scene.js      # three.js
│   ├── vrm-loader.js # model loading
│   ├── animations.js # makes her move
│   ├── chat.js       # ai chat + personality
│   ├── voice.js      # tts
│   └── token-panel.js # chart + socials
└── models/           # vrm files go here
```

## Sol's personality

shes not a typical ai. she:
- uses lowercase, "..." for tension, emojis like 💀 😭 👀
- says stuff like "babe." "don't be shy 👀" "you're lucky you're cute"
- deflects CA questions with "check the site babe"
- teases instead of complimenting directly
- keeps responses short and punchy

## tech

- three.js + @pixiv/three-vrm
- claude api
- dexscreener embed
- vanilla js (no bloat)

## notes

- api key stored in localStorage only
- if model looks weird try a different vrm
- dexscreener chart needs valid CA to load

---

nfa. dyor. iykyk.
