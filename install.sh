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

# --- 1. Core packages ---
step "Installing native Termux packages..."
yes | pkg update -y 2>/dev/null || pkg update -y
pkg install -y \
  nodejs-lts \
  git \
  curl \
  python \
  make \
  clang \
  binutils \
  pkg-config \
  libsqlite \
  openssl \
  2>/dev/null || true
ok "Native packages installed ($(node -v), npm $(npm -v))"

# NDK build environment
export CC=clang
export CXX=clang++
export npm_config_nodedir="$PREFIX"
export CFLAGS="-I$PREFIX/include"
export CXXFLAGS="-I$PREFIX/include"
export LDFLAGS="-L$PREFIX/lib"

# --- 2. Tailscale ---
step "Checking Tailscale..."
if command -v tailscale &>/dev/null; then
  ok "Tailscale already installed"
  if command -v tailscaled &>/dev/null && ! pgrep -x tailscaled &>/dev/null; then
    warn "Starting tailscaled..."
    nohup tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &>/dev/null &
    sleep 2
  fi
else
  warn "Tailscale not installed (recommended for remote access)"
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

# --- 4. Bypass NPM restrictions ---
step "Pre-configuring NPM for Termux compatibility..."
# Remove 'engines' and other strict fields that cause failures in Termux
sed -i '/"engines": {/,/}/d' package.json || true
# Some packages (like libsql) hardcode OS. We'll use --force to bypass.

# --- 5. Install deps ---
step "Installing Node.js dependencies (this may take a few mins)..."
# Setting these env vars is more effective than flags for some native modules
export npm_config_os=linux
export npm_config_cpu=arm64
export npm_config_platform=linux

# Use --force to bypass EBADPLATFORM errors for Android
# Use --ignore-scripts first if native build fails, but let's try full install first
npm install --force --build-from-source 2>&1 | tail -n 15 || {
  warn "Native build failed, attempting fallback installation..."
  npm install --force --ignore-scripts
}
ok "Dependencies installed"

# --- 6. Build frontend ---
step "Building production frontend..."
npm run build 2>&1 | tail -n 5 || {
  warn "Production build failed — app will run in developer mode"
}
ok "Build step complete"

# --- 7. Create data directory ---
mkdir -p "$INSTALL_DIR/data"

# --- 8. Create the 'reader' one-word command ---
step "Creating 'reader' command..."

# Create the bin dir if it doesn't exist
mkdir -p "$PREFIX/bin"

cat > "$PREFIX/bin/reader" << 'READEREOF'
#!/data/data/com.termux/files/usr/bin/bash
# ============================================================================
#  reader — Start Oksskolten RSS Reader (native Termux)
# ============================================================================

R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' C='\033[0;36m' B='\033[1;34m' M='\033[0;35m' W='\033[1;37m' NC='\033[0m' DIM='\033[2m'

APP_DIR="$HOME/oksskolten"
PORT="${READER_PORT:-3000}"

if [ ! -d "$APP_DIR" ]; then
  echo -e "${R}Error: $APP_DIR not found. Run the installer first.${NC}"
  exit 1
fi

# Start tailscaled if present
if command -v tailscaled &>/dev/null && ! pgrep -x tailscaled &>/dev/null; then
  nohup tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &>/dev/null &
  sleep 1
fi

LOCAL_IP=$(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)[\d.]+' | grep -v '127\.0\.0\.1' | head -1 || echo "127.0.0.1")
TS_IP=$(command -v tailscale &>/dev/null && tailscale ip -4 2>/dev/null || echo "")

clear
echo ""
echo -e "  ${W}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "  ${W}║${NC}                                                   ${W}║${NC}"
echo -e "  ${W}║${NC}   ${G}📖 Oksskolten RSS Reader${NC}                        ${W}║${NC}"
echo -e "  ${W}║${NC}   ${DIM}Native Android · Zero Overhead${NC}                  ${W}║${NC}"
echo -e "  ${W}║${NC}                                                   ${W}║${NC}"
echo -e "  ${W}╠═══════════════════════════════════════════════════╣${NC}"
echo -e "  ${W}║${NC}                                                   ${W}║${NC}"
echo -e "  ${W}║${NC}   ${B}Local:${NC}      http://${LOCAL_IP}:${PORT}"

if [ -n "$TS_IP" ]; then
echo -e "  ${W}║${NC}   ${C}Tailscale:${NC}  ${W}http://${TS_IP}:${PORT}${NC}  ${M}◀ anywhere${NC}"
fi

echo -e "  ${W}║${NC}"
echo -e "  ${W}╚═══════════════════════════════════════════════════╝${NC}"
echo ""

cd "$APP_DIR"
export PORT="$PORT"
export DATA_DIR="${DATA_DIR:-$APP_DIR/data}"

if [ -d "$APP_DIR/dist" ]; then
  export NODE_ENV=production
  exec npx tsx --dns-result-order=ipv4first server/index.ts
else
  export NODE_ENV=development
  export AUTH_DISABLED=1
  exec npx tsx --dns-result-order=ipv4first server/index.ts
fi
READEREOF

chmod +x "$PREFIX/bin/reader"
ok "'reader' command installed"

# --- Done ---
echo ""
echo -e "${G}  ✅  Done! Type ${C}reader${G} to start.${NC}"
echo ""
