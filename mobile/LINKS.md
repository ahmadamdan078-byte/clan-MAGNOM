# MAGNOM AI — Your Links

These links work **while your Mac is running the app** (servers started below).

## Open the app on your phone

1. Install **Expo Go** on your phone: https://expo.dev/go
2. Open this link on your phone (or type it in Expo Go → **Enter URL manually**):

```
exp://ohth3mq-anonymous-8081.exp.direct
```

Or scan the QR code by running in Terminal:

```bash
export PATH="$HOME/.local/node/bin:$PATH"
cd /Users/mohammadhamdan/workaroundme/mobile
npx expo start --tunnel
```

## AI backend (already set in the app)

```
https://calm-days-knock.loca.lt
```

If AI does not respond, open **Settings** in the app and set API URL to your Wi‑Fi IP:

```
http://192.168.1.18:3001
```

(Phone and Mac must be on the same Wi‑Fi.)

## Start everything again later

```bash
/Users/mohammadhamdan/workaroundme/mobile/start-magnom.sh
```

## Permanent hosting (no Mac needed)

Fly.io trial ended. For a **permanent** link:

1. **Google Cloud** (free tier): run `./deploy-google.sh` then set API URL to your App Engine URL
2. **Render.com** (free): connect this repo and deploy `server.py`
3. **App Store / Play Store**: run `eas build` after `npm install -g eas-cli && eas login`

## Node.js installed

Node.js is at: `~/.local/node/bin/node` (v22.16.0)

Add to your shell profile to use `node` / `npm` everywhere:

```bash
export PATH="$HOME/.local/node/bin:$PATH"
```
