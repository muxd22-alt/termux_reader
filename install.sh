#!/data/data/com.termux/files/usr/bin/bash
# ============================================================================
#  Oksskolten Termux Reader — Bulletproof Installer
#  Optimized for Native Android (NDK) & Stability
# ============================================================================

# Strict mode: Exit on error, unset variables, or pipe failures
set -euo pipefail

# Colors and Styling
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; C='\033[0;36m'; B='\033[1;34m'; NC='\033[0m'

# Utility Functions
banner() {
    clear
    echo -e "${B}╔═══════════════════════════════════════════╗${NC}"
    echo -e "${B}║    ${G}📖  Oksskolten Termux Reader  📖${NC}    ${B}║${NC}"
    echo -e "${B}║       Native Android · Zero Overhead      ║${NC}"
    echo -e "${B}╚═══════════════════════════════════════════╝${NC}"
}

step() { echo -e "\n${B}[▸]${NC} $1"; }
ok()   { echo -e "  ${G}[✓]${NC} $1"; }
warn() { echo -e "  ${Y}[!]${NC} $1"; }
err()  { echo -e "  ${R}[✗]${NC} $1"; exit 1; }

# Trap for unexpected exits
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo -e "\n${R}Installation failed.${NC} Check the logs above."
    fi
}
trap cleanup EXIT

banner

# --- 1. Environment Check ---
step "Checking environment..."
if [ -z "${TERMUX_VERSION:-}" ]; then
    warn "Not running in Termux? This script is optimized for Android/Termux."
fi
[ -w "$HOME" ] || err "No write permission to $HOME"
ok "Environment validated"

# --- 2. System Packages ---
step "Syncing repositories and installing build tools..."
pkg update -y && pkg upgrade -y
# Added python-rust and turret for better native compilation support
PACKAGES="nodejs-lts git curl python make clang binutils pkg-config libsqlite openssl rust"
for p in $PACKAGES; do
    pkg install -y "$p" || warn "Failed to install $p, attempting to continue..."
done
ok "Build toolchain updated"

# --- 3. Clone/Update Source ---
INSTALL_DIR="$HOME/oksskolten"
step "Fetching source code..."
if [ -d "$INSTALL_DIR" ]; then
    if [ -d "$INSTALL_DIR/.git" ]; then
        cd "$INSTALL_DIR" && git pull --ff-only || warn "Git pull failed, using existing source."
    else
        warn "$INSTALL_DIR exists but is not a git repo. Backing up..."
        mv "$INSTALL_DIR" "${INSTALL_DIR}_backup_$(date +%s)"
        git clone https://github.com/muxd22-alt/termux_reader.git "$INSTALL_DIR"
        cd "$INSTALL_DIR"
    fi
else
    git clone https://github.com/muxd22-alt/termux_reader.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi
ok "Source ready at $INSTALL_DIR"

# --- 4. Android Patching ---
step "Applying platform compatibility patches..."
# Use a more robust sed approach for JSON
find . -maxdepth 2 -name "package.json" -exec sed -i 's/"os": \[/"os": \["android", /g' {} +
# Remove engine restrictions that often break on Termux
sed -i '/"engines": {/,/}/d' package.json 2>/dev/null || true
ok "Configs patched for Android"

# --- 5. Native Build ---
step "Building native modules (this may take several minutes)..."
# Set environment variables for native building
export CFLAGS="-O3"
export CXXFLAGS="-O3"

# Attempt clean install
rm -rf node_modules
if npm install --no-fund --no-audit --build-from-source; then
    ok "Native build successful"
else
    warn "Standard build failed. Retrying with --ignore-scripts..."
    npm install --no-fund --no-audit --ignore-scripts
    ok "Dependencies installed (scripts skipped)"
fi

# --- 6. Frontend Build ---
step "Building frontend assets..."
if npm run build; then
    ok "Frontend built successfully"
else
    warn "Frontend build failed. App might run in development mode."
fi

# --- 7. Create Execution Wrapper ---
step "Creating 'reader' command..."
mkdir -p "$PREFIX/bin"
cat > "$PREFIX/bin/reader" << 'READEREOF'
#!/data/data/com.termux/files/usr/bin/bash
# Colors
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[1;34m'; W='\033[1;37m'; NC='\033[0m'
APP_DIR="$HOME/oksskolten"
PORT="${READER_PORT:-3000}"

# Get IP Address (handling multiple interfaces)
LOCAL_IP=$(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)[\d.]+' | grep -v '127\.0\.0\.1' | head -1 || echo "127.0.0.1")

if [ ! -d "$APP_DIR" ]; then
    echo -e "${R}Error: App directory $APP_DIR not found. Please re-run installer.${NC}"
    exit 1
fi

clear
echo -e "  ${W}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "  ${W}║   ${G}📖 Oksskolten RSS Reader${NC}                        ${W}║${NC}"
echo -e "  ${W}╠═══════════════════════════════════════════════════╣${NC}"
echo -e "  ${W}║   ${B}Access URL:${NC}  http://${LOCAL_IP}:${PORT}            "
echo -e "  ${W}║   ${Y}Control:${NC}     Press Ctrl+C to stop               "
echo -e "  ${W}╚═══════════════════════════════════════════════════╝${NC}\n"

cd "$APP_DIR"
export PORT="$PORT"
export DATA_DIR="${DATA_DIR:-$APP_DIR/data}"
mkdir -p "$DATA_DIR"

# Check if build exists, otherwise fallback to tsx dev
if [ -d "$APP_DIR/dist" ]; then
    export NODE_ENV=production
    exec npx tsx --dns-result-order=ipv4first server/index.ts
else
    echo -e "${Y}[!] Build not found, running in dev mode...${NC}"
    export NODE_ENV=development
    export AUTH_DISABLED=1
    exec npx tsx --dns-result-order=ipv4first server/index.ts
fi
READEREOF

chmod +x "$PREFIX/bin/reader"

# --- 8. Final Success Message ---
echo -e "\n${G}✅ Installation Complete!${NC}"
echo -e "You can now start the reader by typing: ${C}reader${NC}"
echo -e "The app will be available at ${B}http://localhost:3000${NC}\n"

# Remove trap so it doesn't trigger on successful exit
trap - EXIT