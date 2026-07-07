# MAGNOM AI — Mobile App

A cross-platform **Android & iPhone** AI chat app built with **React Native (Expo)**. Ask anything — coding, learning, writing, ideas, and more. Conversations are saved on your device with full chat history.

## Features

- **High-level AI** — Uses Groq (Llama 3.3 70B), OpenAI (GPT-4o), Anthropic (Claude), or a free fallback
- **Ask anything** — General-purpose assistant, not limited to one topic
- **Chat history** — All conversations saved locally on your phone
- **Beautiful UI** — Dark theme, markdown answers, smooth chat experience
- **Android + iOS** — One codebase for both platforms

## Quick Start

### 1. Start the AI backend

```bash
cd /Users/mohammadhamdan/workaroundme
python3 server.py
```

For **best AI quality**, set an API key before starting:

```bash
export GROQ_API_KEY="your-groq-key"          # Recommended — fast & free tier
# OR
export OPENAI_API_KEY="your-openai-key"      # GPT-4o
# OR
export ANTHROPIC_API_KEY="your-anthropic-key" # Claude
python3 server.py
```

Get a free Groq key at [console.groq.com](https://console.groq.com).

### 2. Install & run the mobile app

Requires [Node.js 18+](https://nodejs.org) and the [Expo Go](https://expo.dev/go) app on your phone.

```bash
cd mobile
npm install
npx expo start
```

- **iPhone**: Scan the QR code with your Camera app → opens in Expo Go
- **Android**: Scan the QR code with the Expo Go app

### 3. Configure API URL (physical device)

If testing on a real phone, `localhost` won't work. In the app:

1. Tap **Settings** (gear icon)
2. Set **API URL** to your computer's IP, e.g. `http://192.168.1.5:3000`
3. Tap **Save**

Find your IP on Mac: `ipconfig getifaddr en0`

## Build for App Store / Play Store

```bash
cd mobile
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios      # iPhone
eas build --platform android  # Android
```

## Project Structure

```
mobile/
├── app/                 # Screens (Expo Router)
│   ├── index.tsx        # Main chat
│   ├── history.tsx      # Past conversations
│   └── settings.tsx     # API URL & info
├── src/
│   ├── api.ts           # Calls /api/ai/chat
│   ├── storage.ts       # Local conversation history
│   ├── components/      # Chat UI components
│   └── theme.ts         # Colors & spacing
└── assets/              # App icon & splash
```

## API Endpoint

The mobile app talks to:

```
POST /api/ai/chat
{
  "message": "Your question",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

Response: `{ "reply": "AI answer..." }`
