#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

if ! command -v xcodebuild >/dev/null 2>&1; then
  echo "error: xcodebuild not found. Install Xcode from the Mac App Store." >&2
  exit 1
fi

ARCHIVE_PATH="${1:-$ROOT/build/DeezPDF.xcarchive}"
EXPORT_PATH="${2:-$ROOT/build/export}"

echo "→ Syncing web assets into ios/…"
npm run cap:sync

mkdir -p "$(dirname "$ARCHIVE_PATH")"

echo "→ Archiving Release build…"
xcodebuild \
  -project ios/App/DeezPDF.xcodeproj \
  -scheme DeezPDF \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE_PATH" \
  archive

echo ""
echo "Archive ready: $ARCHIVE_PATH"
echo ""
echo "Next steps:"
echo "  Xcode:  open ios/App/DeezPDF.xcodeproj → Window → Organizer → Distribute App"
echo "  CLI:    npm run ios:export"
