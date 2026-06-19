#!/bin/bash
cd "$(dirname "$0")"
node launcher/index.js
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo ""
  echo "Press Enter to close..."
  read
fi

osascript -e 'tell application "Terminal" to close front window' 2>/dev/null || exit $EXIT_CODE
