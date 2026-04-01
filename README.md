# 📖 Termux Reader

**Oksskolten RSS Reader** — running natively on Android via Termux. No proot, no Docker, no containers. Pure NDK, zero overhead.

Access your reader from anywhere over **Tailscale**.

---

## ⚡ One-Liner Install

```bash
curl -fsSL https://raw.githubusercontent.com/muxd22-alt/termux_reader/main/install.sh | bash
```

This will:
- Install Node.js, build tools, and native dependencies via `pkg`
- Set up Tailscale (userspace networking, no root)
- Clone and build Oksskolten
- Create the `reader` command

## 🚀 Run

```bash
reader
```

That's it. One word. It shows your Tailscale IP and port, then starts the server:

```
  ╔═══════════════════════════════════════════════════╗
  ║                                                   ║
  ║   📖  Oksskolten RSS Reader                      ║
  ║   Native Android · Tailscale Ready                ║
  ║                                                   ║
  ╠═══════════════════════════════════════════════════╣
  ║                                                   ║
  ║   Local:      http://192.168.1.50:3000            ║
  ║   Tailscale:  http://100.64.0.12:3000    ◀ anywhere║
  ║                                                   ║
  ╚═══════════════════════════════════════════════════╝
```

## 🔧 Configuration

| Variable | Default | Description |
|---|---|---|
| `READER_PORT` | `3000` | Server port |
| `DATA_DIR` | `~/oksskolten/data` | SQLite database location |

```bash
# Custom port
READER_PORT=8080 reader
```

## 📡 Tailscale Setup

After install, authenticate once:

```bash
tailscale up
```

Then `reader` will auto-detect and display your Tailscale IP. Access from any device on your tailnet.

## 🏗️ Architecture

```
Termux (Native Android NDK)
├── Node.js 22 (pkg)
├── Oksskolten Server (Fastify + SQLite)
├── Built SPA (React)
└── Tailscale (userspace networking)
```

**No proot. No Docker. No overhead.** The server runs as a native Termux process directly on Android's Linux kernel.

## 📋 What's Oksskolten?

An AI-native RSS reader that fetches full article text by default. Features:
- Full-text extraction for every article
- AI summarization & translation (Anthropic/Gemini/OpenAI)
- Full-text search (Meilisearch)
- PWA with offline reading
- 14 themes + custom theme support

See the [upstream project](https://github.com/babarot/oksskolten) for details.

## 📄 License

[AGPL-3.0](LICENSE)
