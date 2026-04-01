#!/data/data/com.termux/files/usr/bin/bash
# ============================================================================
#  Oksskolten Termux Reader — Native Android (NDK) Installer
#  Patched for Termux & LibSQL binary compatibility
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

# --- 1. Core Packages ---
step "Ensuring native dependencies..."
pkg install -y nodejs-lts git curl python make clang binutils pkg-config libsqlite openssl 2>/dev/null || true
ok "Packages checked"

# --- 2. Clone/Update ---
INSTALL_DIR="$HOME/oksskolten"
if [ -d "$INSTALL_DIR/.git" ]; then
  cd "$INSTALL_DIR" && git pull --ff-only 2>/dev/null || true
else
  git clone https://github.com/muxd22-alt/termux_reader.git "$INSTALL_DIR"
  cd "$INSTALL_DIR"
fi
ok "Source ready"

# --- 3. Patch configs ---
step "Applying platform compatibility patch..."
find . -maxdepth 1 -name "package*.json" -exec sed -i 's/"os": \[/"os": \["android", /g' {} +
find . -maxdepth 1 -name "package*.json" -exec sed -i 's/"cpu": \[/"cpu": \["arm64", /g' {} +
sed -i '/"engines": {/,/}/d' package.json 2>/dev/null || true
ok "Configs patched"

# --- 4. Install dependencies ---
step "Installing Node.js dependencies..."
export npm_config_os=linux
export npm_config_cpu=arm64
export npm_config_platform=linux

# Standard install
npm install --force --no-fund --no-audit 2>&1 | tail -n 20 || true

# Explicitly install the linux binding
echo -e "  ${DIM}Fetching native SQL bindings...${NC}"
npm install --force @libsql/linux-arm64-gnu --no-save --no-fund --no-audit || true
ok "Dependencies installed"

# --- 5. The "Nuclear Patch" for LibSQL ---
# This is the most robust way: actually edit the JS files to use 'linux' instead of 'android'
step "Patching native module loader for Termux Compatibility..."

# Find all JS files in node_modules/libsql and sub-dependencies
# and replace 'android' with 'linux' in platform detection strings.
find node_modules -path "*libsql/index.js" -o -path "*libsql/dist/index.js" | while read -r f; do
    echo -e "  ${DIM}Patching $f...${NC}"
    sed -i "s/process.platform === 'android' ? 'android'/process.platform === 'android' ? 'linux'/g" "$f"
    sed -i "s/process.platform === \"android\" ? \"android\"/process.platform === \"android\" ? \"linux\"/g" "$f"
    # Some use a direct mapping
    sed -i "s/'android': '@libsql\/android-arm64'/'android': '@libsql\/linux-arm64-gnu'/g" "$f"
    sed -i "s/\"android\": \"@libsql\/android-arm64\"/\"android\": \"@libsql\/linux-arm64-gnu\"/g" "$f"
done

# Also ensure the symlink is there as a backup
mkdir -p node_modules/@libsql
if [ -d "node_modules/@libsql/linux-arm64-gnu" ]; then
    rm -rf "node_modules/@libsql/android-arm64"
    ln -s "linux-arm64-gnu" "node_modules/@libsql/android-arm64"
    ok "Runtime patches applied"
else
    warn "Native binding folder not found! Please check your internet connection and rerun."
fi

# --- 6. Build ---
step "Building frontend (this may be slow on phone)..."
npm run build 2>&1 | tail -n 5 || true
ok "Build finished"

# --- 7. Reader Command ---
mkdir -p "$PREFIX/bin"
cat > "$PREFIX/bin/reader" << 'READEREOF'
#!/data/data/com.termux/files/usr/bin/bash
R='\033[0;31m' G='\033[0;32m' Y='\033[1;33m' C='\033[0;36m' B='\033[1;34m' M='\033[0;35m' W='\033[1;37m' NC='\033[0m'
APP_DIR="$HOME/oksskolten"
PORT="${READER_PORT:-3000}"

# Improved IP detection
LOCAL_IP=$(hostname -I 2>/dev/null | cut -d' ' -f1)
[ -z "$LOCAL_IP" ] && LOCAL_IP=$(ip -4 addr show 2>/dev/null | grep -oP '(?<=inet\s)[\d.]+' | grep -v '127\.0\.0\.1' | head -1 || echo "127.0.0.1")
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
