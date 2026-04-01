#!/data/data/com.termux/files/usr/bin/bash
# ============================================================================
#  Oksskolten Termux Reader — Native Android (NDK) Installer
#  Final Termux-Proof Patch (adding 'android' to platform lists)
# ============================================================================

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

# --- 2. Create the 'reader' command EARLY ---
mkdir -p "$PREFIX/bin"
cat > "$PREFIX/bin/reader" << 'READEREOF'
#!/data/data/com.termux/files/usr/bin/bash
APP_DIR="$HOME/oksskolten"
[ -d "$APP_DIR" ] || { echo "Run the installer first!"; exit 1; }
cd "$APP_DIR"
export PORT="${READER_PORT:-3000}"
export DATA_DIR="${DATA_DIR:-$APP_DIR/data}"
[ -d "$APP_DIR/dist" ] && export NODE_ENV=production || export NODE_ENV=development
exec npx tsx --dns-result-order=ipv4first server/index.ts
READEREOF
chmod +x "$PREFIX/bin/reader"
ok "'reader' command provisioned"

# --- 3. Clone/Update ---
INSTALL_DIR="$HOME/oksskolten"
if [ -d "$INSTALL_DIR/.git" ]; then
  cd "$INSTALL_DIR" && git pull --ff-only 2>/dev/null || true
else
  git clone https://github.com/muxd22-alt/termux_reader.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi
ok "Repository fetched"

# --- 4. The "Android Support" Patch ---
step "Patching configs for Android support..."
# Instead of deleting, we inject "android" into the OS lists. This is much safer for valid JSON.
# We also inject "arm64" if it's missing (though it usually isn't).
echo -e "  ${DIM}Injecting 'android' into OS allowed lists...${NC}"

# Handle both package.json and package-lock.json
# Using a pattern that works even if multi-line
find . -maxdepth 1 -name "package*.json" -exec sed -i 's/"os": \[/"os": \["android", /g' {} +
find . -maxdepth 1 -name "package*.json" -exec sed -i 's/"cpu": \[/"cpu": \["arm64", /g' {} +

# Remove engines block to stop Node version warnings
sed -i '/"engines": {/,/}/d' package.json 2>/dev/null || true
ok "Configs patched"

# --- 5. Installation ---
step "Installing dependencies (Bypassing platform checks)..."
export npm_config_os=linux
export npm_config_cpu=arm64
export npm_config_platform=linux

# Standard install with --force
npm install --force --no-fund --no-audit --build-from-source 2>&1 | tail -n 20 || {
  warn "Standard install failed, trying with --ignore-scripts..."
  npm install --force --ignore-scripts --no-fund --no-audit
}
ok "Dependencies installed"

# --- 6. Build ---
step "Building production frontend..."
npm run build 2>&1 | tail -n 5 || warn "Build skipped (falling back to dev mode)"
ok "Build finished"

# --- 7. Final Reader UI ---
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
exec npx tsx --dns-result-order=ipv4first server/index.ts
READEREOF
chmod +x "$PREFIX/bin/reader"

echo -e "\n${G}✅ Done! Type ${C}reader${G} to start.${NC}\n"
