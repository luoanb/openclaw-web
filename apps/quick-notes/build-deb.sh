#!/usr/bin/env bash
# Build and post-process the .deb for quick-notes
# Fixes: desktop Name=速记, icon cache auto-update via postinst
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== 1. Regenerate icons ==="
pnpm tauri icon src-tauri/icons/icon.svg 2>&1

echo "=== 2. Build .deb ==="
pnpm tauri build --bundles deb 2>&1

DEB_DIR="src-tauri/target/release/bundle/deb"
DEB_FILE=$(ls "$DEB_DIR"/*.deb 2>/dev/null | head -1)
DEB_BASENAME="quick-notes_0.0.0_amd64.deb"
DEB_OUT="$DEB_DIR/$DEB_BASENAME"

echo "=== 3. Post-process .deb ==="
WORKDIR="/tmp/tauri-deb-fix"
rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"

# Extract
cd "$WORKDIR"
ar x "$DEB_FILE" 2>/dev/null || {}

# --- Fix data: patch .desktop Name ---
mkdir data
tar xzf data.tar.gz -C data
find data -name "*.desktop" | while read -r desktop; do
  sed -i 's/^Name=[^/]*$/Name=速记/' "$desktop"
  if ! grep -q "^Name\[zh\]=" "$desktop"; then
    echo 'Name[zh]=速记' >> "$desktop"
  fi
done
cd data
tar czf "$WORKDIR/data.tar.gz" .
cd "$WORKDIR"

# --- Fix control: add postinst for icon cache ---
mkdir ctrl
tar xzf control.tar.gz -C ctrl
cat > ctrl/postinst << 'POSTINST'
#!/bin/sh
set -e

case "$1" in
  configure)
    if command -v gtk-update-icon-cache >/dev/null 2>&1; then
      gtk-update-icon-cache -f -t /usr/share/icons/hicolor >/dev/null 2>&1 || true
    fi
    if command -v update-desktop-database >/dev/null 2>&1; then
      update-desktop-database >/dev/null 2>&1 || true
    fi
    ;;
esac
exit 0
POSTINST
chmod 755 ctrl/postinst
cd ctrl
tar czf "$WORKDIR/control.tar.gz" .
cd "$WORKDIR"

# Repack
cp "$DEB_FILE" "${DEB_FILE}.bak" 2>/dev/null || true
mv "$DEB_FILE" "$DEB_OUT" 2>/dev/null || true
ar rcs "$DEB_OUT" debian-binary control.tar.gz data.tar.gz
rm -rf "$WORKDIR"

echo ""
echo "=== Done: $DEB_OUT ==="
echo ""
echo "Install:"
echo "  sudo dpkg -i '$DEB_OUT'"
echo ""
echo "Restart the app to see the new icon in the dock."
