#!/usr/bin/env bash
# Generate Tauri app icons from public/logo.png
set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="$PROJECT_ROOT/public/logo.png"
ICONS_DIR="$PROJECT_ROOT/src-tauri/icons"

if [[ ! -f "$SRC" ]]; then
  echo "Source logo not found: $SRC"
  exit 1
fi

mkdir -p "$ICONS_DIR"
cd "$ICONS_DIR"

# Force exact square dimensions for icons (scale and crop to fill)
resize_square() {
  local size=$1
  local out=$2
  magick "$SRC" -resize "${size}x${size}^" -gravity center -extent "${size}x${size}" -strip -alpha on "$out"
}

echo "Generating PNG sizes..."
resize_square 32 "32x32.png"
resize_square 128 "128x128.png"
resize_square 256 "128x128@2x.png"

echo "Generating icon.ico (Windows)..."
magick "$SRC" -resize 256x256^ -gravity center -extent 256x256 -strip -define icon:auto-resize=256,128,64,48,32,16 icon.ico

echo "Generating icon.icns (macOS)..."
ICONSET="icon.iconset"
rm -rf "$ICONSET"
mkdir -p "$ICONSET"
resize_square 16 "$ICONSET/icon_16x16.png"
resize_square 32 "$ICONSET/icon_16x16@2x.png"
resize_square 32 "$ICONSET/icon_32x32.png"
resize_square 64 "$ICONSET/icon_32x32@2x.png"
resize_square 128 "$ICONSET/icon_128x128.png"
resize_square 256 "$ICONSET/icon_128x128@2x.png"
resize_square 256 "$ICONSET/icon_256x256.png"
resize_square 512 "$ICONSET/icon_256x256@2x.png"
resize_square 512 "$ICONSET/icon_512x512.png"
resize_square 1024 "$ICONSET/icon_512x512@2x.png"

if command -v iconutil >/dev/null 2>&1; then
  iconutil -c icns "$ICONSET" -o icon.icns
  rm -rf "$ICONSET"
  echo "icon.icns created."
else
  echo "iconutil not found (macOS only). Leave icon.iconset for manual: iconutil -c icns icon.iconset -o icon.icns"
fi

echo "Done. Icons in $ICONS_DIR"
