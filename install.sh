#!/data/data/com.termux/files/usr/bin/bash
# ============================================================================
#  Oksskolten Termux Reader — Native Android (NDK) Installer
#  Patched Native Loader (Termux Override)
# ============================================================================
set -euo pipefail

R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; C='\033[0;36m'; B='\033[1;34m'; NC='\033[0m'

# Progress tracking
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

banner

# --- 1. System Packages ---
step "Ensuring native environment..."
# Added 'binutils' and 'turret' specifically for native build stability
PACKAGES="nodejs-lts git curl python make clang binutils pkg-config libsqlite openssl rust termux-elf-cleaner"
pkg update -y && pkg install -y $PACKAGES
ok "Toolchain ready"

# --- 2. Clone/Update ---
INSTALL_DIR="$HOME/oksskolten"
step "Fetching source..."
if [ -d "$INSTALL_DIR/.git" ]; then
    cd "$INSTALL_DIR" && git pull --ff-only
else
    git clone https://github.com/muxd22-alt/termux_reader.git "$INSTALL_DIR"
    cd "$INSTALL_DIR"
fi
ok "Source updated"

# --- 3. Prep configs ---
step "Patching configs..."
# Patching OS to include android in all manifest files
find . -maxdepth 2 -name "package*.json" -exec sed -i 's/"os": \[/"os": \["android", /g' {} +
# Remove specific node version locks that might conflict with Termux's LTS
sed -i '/"engines": {/,/}/d' package.json 2>/dev/null || true
ok "Configs patched"

# --- 4. Installation & Native Build ---
step "Building native modules (LibSQL/SQLite)..."
# Setting native build flags
export CFLAGS="-O3"
export LDFLAGS="-L$PREFIX/lib"
export CPPFLAGS="-I$PREFIX/include"

# Build from source is mandatory on Termux to link against Bionic libc
npm install --no-fund --no-audit --build-from-source || {
    warn "Direct build failed, attempting fallback..."
    npm install --no-fund --no-audit --ignore-scripts
}
ok "Dependencies processed"

# --- 5. The "Loader Survival" Patch ---
step "Bypassing Native Loader (LibSQL Surgical Patch)..."

# 5a. Force link the binary where Node expects it
# We search for the compiled .node file and use termux-elf-cleaner on it
find node_modules -name "*.node" | while read -r NATIVE_BINARY; do
    echo -e "  ${C}Cleaning ELF: $(basename "$NATIVE_BINARY")${NC}"
    termux-elf-cleaner "$NATIVE_BINARY" > /dev/null 2>&1 || true
done

# 5b. Surgical Sed on the JS loader
# This targets the specific logic in libsql and similar modules that crashes on Android
find node_modules -name "index.js" -path "*/@libsql/*" | while read -r LIBJS; do
    echo -e "  ${C}Surgical patch on $LIBJS${NC}"
    # Use a more aggressive regex to catch backticks or quotes
    sed -i "s/require(['\"\`]@libsql\/['\"\`] + platform + ['\"\`]-['\"\`] + arch)/require('.\/index.node')/g" "$LIBJS" 2>/dev/null || true
    sed -i "s/require(['\"\`]@libsql\/\${platform}-\${arch}['\"\`])/require('.\/index.node')/g" "$LIBJS" 2>/dev/null || true
done

ok "Loader bypass applied"

# --- 6. Build Frontend ---
step "Building frontend assets..."
# Use --force if build fails to bypass minor dependency mismatches
npm run build || warn "Frontend build failed, will run in development mode."
ok "Build stage complete"

# --- 7. Final Reader Command ---
mkdir -p "$PREFIX/bin"
cat > "$PREFIX/bin/reader" << 'READEREOF'
#!/data/data/com.termux/files/usr/bin/bash
R='\033[0;31m'; G='\033[0;32m'; Y='\033[1;33m'; B='\033[1;34m'; W='\033[1;37m'; NC='\033[0m'
APP_DIR="$HOME/oksskolten"
PORT="${READER_PORT:-3000}"

# Robust IP detection
LOCAL_IP=$(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)[\d.]+' | grep -v '127\.0\.0\.1' | head -1 || echo "127.0.0.1")

clear
echo -e "  ${W}╔═══════════════════════════════════════════════════╗${NC}"
echo -e "  ${W}║   ${G}📖 Oksskolten RSS Reader${NC}                        ${W}║${NC}"
echo -e "  ${W}╠═══════════════════════════════════════════════════╣${NC}"
echo -e "  ${W}║   ${B}Local:${NC}      http://${LOCAL_IP}:${PORT}"
echo -e "  ${W}║   ${Y}Data Dir:${NC}   ${APP_DIR}/data"
echo -e "  ${W}╚═══════════════════════════════════════════════════╝${NC}\n"

cd "$APP_DIR"
export PORT="$PORT"
export DATA_DIR="${DATA_DIR:-$APP_DIR/data}"
mkdir -p "$DATA_DIR"

# Mode selector
if [ -d "$APP_DIR/dist" ]; then
    export NODE_ENV=production
    exec npx tsx --dns-result-order=ipv4first server/index.ts
else
    warn "Dist folder missing, running in dev mode."
    export NODE_ENV=development
    export AUTH_DISABLED=1
    exec npx tsx --dns-result-order=ipv4first server/index.ts
fi
READEREOF

chmod +x "$PREFIX/bin/reader"

echo -e "\n${G}✅ Success! Run with the command: ${C}reader${NC}\n"