#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -d /Applications/Xcode.app/Contents/Developer ]]; then
  export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
fi

ARCHIVE_PATH="${1:-$ROOT/build/DeezPDF.xcarchive}"
EXPORT_PATH="${2:-$ROOT/build/export}"

if [[ ! -d "$ARCHIVE_PATH" ]]; then
  echo "error: archive not found at $ARCHIVE_PATH" >&2
  echo "Run: npm run ios:archive" >&2
  exit 1
fi

rm -rf "$EXPORT_PATH"
mkdir -p "$EXPORT_PATH"

echo "→ Exporting App Store IPA…"
xcodebuild \
  -exportArchive \
  -archivePath "$ARCHIVE_PATH" \
  -exportPath "$EXPORT_PATH" \
  -exportOptionsPlist "$ROOT/ios/ExportOptions.plist"

echo ""
echo "Export ready: $EXPORT_PATH"
echo "Upload the .ipa via Xcode Organizer or Transporter."
