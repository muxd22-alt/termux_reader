#!/data/data/com.termux/files/usr/bin/bash
# ============================================================================
#  Oksskolten Termux Reader — Native Android (NDK) Installer
#  Zero overhead: no proot, no Docker, no containers. Pure Termux.
#
#  One-liner:
#    curl -fsSL https://raw.githubusercontent.com/muxd22-alt/termux_reader/main/install.sh | bash
# ============================================================================
set -euo pipefail

R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' C='\033[0;36m' B='\033[1;34m' NC='\033[0m'

banner() {
cat << 'EOF'

   ╔═══════════════════════════════════════════╗
   ║     📖  Oksskolten Termux Reader  📖     ║
   ║      Native Android · Zero Overhead       ║
   ╚═══════════════════════════════════════════╝

EOF
}

step() { echo -e "\n${B}[▸]${NC} $1"; }
ok()   { echo -e "  ${G}[✓]${NC} $1"; }
warn() { echo -e "  ${Y}[!]${NC} $1"; }
fail() { echo -e "  ${R}[✗]${NC} $1"; exit 1; }

banner

# --- 1. Core packages (all NDK-native, no proot) ---
step "Installing native Termux packages..."
yes | pkg update -y 2>/dev/null || pkg update -y
pkg install -y \
  nodejs \
  git \
  curl \
  python \
  make \
  clang \
  binutils \
  pkg-config \
  libsqlite \
  openssl \
  2>/dev/null
ok "Native packages installed ($(node -v), npm $(npm -v))"

# NDK build environment for native modules (libsql/better-sqlite3)
export CC=clang
export CXX=clang++
export npm_config_nodedir="$PREFIX"
export CFLAGS="-I$PREFIX/include"
export CXXFLAGS="-I$PREFIX/include"
export LDFLAGS="-L$PREFIX/lib"

# --- 2. Tailscale (native binary) ---
step "Setting up Tailscale..."
if ! command -v tailscale &>/dev/null; then
  pkg install -y tailscale 2>/dev/null && ok "Tailscale installed" || {
    warn "Tailscale not in repos — install manually:"
    echo -e "    ${C}https://tailscale.com/download/linux${NC}"
  }
else
  ok "Tailscale already installed"
fi

# Start tailscaled if available but not running
if command -v tailscaled &>/dev/null && ! pgrep -x tailscaled &>/dev/null; then
  warn "Starting tailscaled in background..."
  nohup tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &>/dev/null &
  sleep 2
fi

if command -v tailscale &>/dev/null && tailscale status &>/dev/null 2>&1; then
  ok "Tailscale connected: $(tailscale ip -4 2>/dev/null)"
else
  warn "Run ${C}tailscale up${NC} after install to authenticate"
fi

# --- 3. Clone / Update ---
INSTALL_DIR="$HOME/oksskolten"
step "Fetching Oksskolten source..."

if [ -d "$INSTALL_DIR/.git" ]; then
  cd "$INSTALL_DIR"
  git pull --ff-only 2>/dev/null || true
  ok "Repository updated"
else
  rm -rf "$INSTALL_DIR"
  git clone https://github.com/muxd22-alt/termux_reader.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
  ok "Repository cloned"
fi

# --- 4. Install deps (with NDK flags for native compilation) ---
step "Installing Node.js dependencies..."
cd "$INSTALL_DIR"

# Full install needed for build step (includes devDependencies)
npm install --build-from-source 2>&1 | tail -5
ok "Dependencies installed"

# --- 5. Build frontend ---
step "Building production frontend..."
npm run build 2>&1 | tail -3
ok "Frontend built"

# Prune devDependencies to save space
npm prune --omit=dev 2>/dev/null || true
ok "Dev dependencies pruned"

# --- 6. Create data directory ---
mkdir -p "$INSTALL_DIR/data"

# --- 7. Create the 'reader' one-word command ---
step "Creating 'reader' command..."

cat > "$PREFIX/bin/reader" << 'READEREOF'
#!/data/data/com.termux/files/usr/bin/bash
# ============================================================================
#  reader — Start Oksskolten RSS Reader (native Termux)
# ============================================================================

R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' C='\033[0;36m' B='\033[1;34m' M='\033[0;35m' W='\033[1;37m' NC='\033[0m' DIM='\033[2m'

APP_DIR="$HOME/oksskolten"
PORT="${READER_PORT:-3000}"

[ -d "$APP_DIR" ] || { echo -e "${R}Error: $APP_DIR not found. Run the installer first.${NC}"; exit 1; }

# --- Ensure tailscaled is running ---
if command -v tailscaled &>/dev/null && ! pgrep -x tailscaled &>/dev/null; then
  nohup tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &>/dev/null &
  sleep 2
fi

# --- Gather IPs ---
LOCAL_IP=$(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)[\d.]+' | grep -v '127\.0\.0\.1' | head -1)
LOCAL_IP="${LOCAL_IP:-127.0.0.1}"

TS_IP=""
if command -v tailscale &>/dev/null; then
  TS_IP=$(tailscale ip -4 2>/dev/null || true)
fi

# --- Display ---
clear
echo ""
echo -e "  ${W}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "  ${W}║${NC}                                                   ${W}║${NC}"
echo -e "  ${W}║${NC}   ${G}📖  Oksskolten RSS Reader${NC}                      ${W}║${NC}"
echo -e "  ${W}║${NC}   ${DIM}Native Android · Tailscale Ready${NC}                ${W}║${NC}"
echo -e "  ${W}║${NC}                                                   ${W}║${NC}"
echo -e "  ${W}╠═══════════════════════════════════════════════════╣${NC}"
echo -e "  ${W}║${NC}                                                   ${W}║${NC}"
echo -e "  ${W}║${NC}   ${B}Local:${NC}      http://${LOCAL_IP}:${PORT}            ${W}║${NC}"

if [ -n "$TS_IP" ]; then
echo -e "  ${W}║${NC}   ${C}Tailscale:${NC}  ${W}http://${TS_IP}:${PORT}${NC}    ${M}◀ anywhere${NC}  ${W}║${NC}"
else
echo -e "  ${W}║${NC}   ${Y}Tailscale:${NC}  not connected                      ${W}║${NC}"
echo -e "  ${W}║${NC}   ${DIM}Run: tailscale up${NC}                              ${W}║${NC}"
fi

echo -e "  ${W}║${NC}                                                   ${W}║${NC}"
echo -e "  ${W}╚═══════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${DIM}Ctrl+C to stop${NC}"
echo ""

# --- Start server ---
cd "$APP_DIR"

export PORT="$PORT"
export DATA_DIR="${DATA_DIR:-$APP_DIR/data}"
export NODE_ENV=production
export CC=clang
export CXX=clang++

mkdir -p "$DATA_DIR"

exec npx tsx --dns-result-order=ipv4first server/index.ts
READEREOF

chmod +x "$PREFIX/bin/reader"
ok "'reader' command installed"

# --- Done ---
echo ""
echo -e "${G}  ╔═══════════════════════════════════════════════╗${NC}"
echo -e "${G}  ║          ✅  Installation Complete!           ║${NC}"
echo -e "${G}  ╠═══════════════════════════════════════════════╣${NC}"
echo -e "${G}  ║${NC}                                               ${G}║${NC}"
echo -e "${G}  ║${NC}   Type ${C}reader${NC} to start                       ${G}║${NC}"
echo -e "${G}  ║${NC}                                               ${G}║${NC}"
echo -e "${G}  ╚═══════════════════════════════════════════════╝${NC}"
echo ""
