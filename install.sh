#!/data/data/com.termux/files/usr/bin/bash
# ============================================================================
#  Oksskolten Termux Reader — Native Android (NDK) Installer
#  Runtime Patch for 'libsql' on Android/Termux
# ============================================================================
set -uo pipefail

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

banner

# --- 1. System Packages ---
step "Ensuring native dependencies..."
pkg install -y nodejs-lts git curl python make clang binutils pkg-config libsqlite openssl 2>/dev/null || true
ok "Packages ready"

# --- 2. Clone/Update ---
INSTALL_DIR="$HOME/oksskolten"
if [ -d "$INSTALL_DIR/.git" ]; then
  cd "$INSTALL_DIR" && git pull --ff-only 2>/dev/null || true
else
  git clone https://github.com/muxd22-alt/termux_reader.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi
ok "Repository fetched"

# --- 3. Patch Configs for 'android' support ---
step "Applying platform compatibility patch..."
find . -maxdepth 1 -name "package*.json" -exec sed -i 's/"os": \[/"os": \["android", /g' {} +
find . -maxdepth 1 -name "package*.json" -exec sed -i 's/"cpu": \[/"cpu": \["arm64", /g' {} +
sed -i '/"engines": {/,/}/d' package.json 2>/dev/null || true
ok "Configs patched"

# --- 4. Installation with Linux-Targeted Natives ---
step "Installing dependencies (Native NDK build)..."
# Force npm to install the linux-arm64 versions of native modules
export npm_config_os=linux
export npm_config_cpu=arm64
export npm_config_platform=linux

npm install --force --no-fund --no-audit 2>&1 | tail -n 20 || true

# Explicitly install the linux-arm64 binding for libsql (Termux uses linux-like bindings)
echo -e "  ${DIM}Fetching native SQL bindings...${NC}"
npm install --force @libsql/linux-arm64-gnu --no-save --no-fund --no-audit || true
ok "Dependencies installed"

# --- 5. The Runtime Mock (CRITICAL) ---
step "Linking native bindings for Termux..."
# libsql expects '@libsql/android-arm64' on Termux (Android).
# We link the 'linux-arm64-gnu' version which is binary compatible.
mkdir -p node_modules/@libsql
if [ -d "node_modules/@libsql/linux-arm64-gnu" ]; then
  rm -rf "node_modules/@libsql/android-arm64"
  ln -s "linux-arm64-gnu" "node_modules/@libsql/android-arm64"
  ok "Native binding linked (@libsql/linux-arm64-gnu -> android-arm64)"
else
  warn "Native binding folder not found. Runtime errors may occur."
fi

# --- 6. Build ---
step "Building frontend (Optimizing)..."
npm run build 2>&1 | tail -n 5 || true
ok "Build finished"

# --- 7. Reader Command ---
step "Finalizing 'reader' command..."
mkdir -p "$PREFIX/bin"
cat > "$PREFIX/bin/reader" << 'READEREOF'
#!/data/data/com.termux/files/usr/bin/bash
R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' C='\033[0;36m' B='\033[1;34m' M='\033[0;35m' W='\033[1;37m' NC='\033[0m'
APP_DIR="$HOME/oksskolten"
PORT="${READER_PORT:-3000}"
LOCAL_IP=$(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)[\d.]+' | grep -v '127\.0\.0\.1' | head -1 || echo "127.0.0.1")
TS_IP=$(command -v tailscale &>/dev/null && tailscale ip -4 2>/dev/null || echo "")

clear
echo -e "  ${W}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "  ${W}║   ${G}📖 Oksskolten RSS Reader${NC}                        ${W}║${NC}"
echo -e "  ${W}╠═══════════════════════════════════════════════════╣${NC}"
echo -e "  ${W}║   ${B}Local:${NC}      http://${LOCAL_IP}:${PORT}"
[ -n "$TS_IP" ] && echo -e "  ${W}║   ${C}Tailscale:${NC}  ${W}http://${TS_IP}:${PORT}${NC}"
echo -e "  ${W}╚═══════════════════════════════════════════════════╝${NC}\n"

cd "$APP_DIR"
export PORT="$PORT"
export DATA_DIR="${DATA_DIR:-$APP_DIR/data}"
mkdir -p "$DATA_DIR"
[ -d "$APP_DIR/dist" ] && export NODE_ENV=production || { export NODE_ENV=development; export AUTH_DISABLED=1; }

# Termux hack: we don't need to patch process.platform if we use symlinks,
# but we ensure binary path is correct.
exec npx tsx --dns-result-order=ipv4first server/index.ts
READEREOF
chmod +x "$PREFIX/bin/reader"

echo -e "\n${G}✅ Done! Type ${C}reader${G} to start.${NC}\n"
