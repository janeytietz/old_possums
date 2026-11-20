#!/bin/bash
# Build "Old Possum.app" from the Swift code here and the web app one folder up.
#
#   ./mac/build.sh            -> mac/build/Old Possum.app
#   ./mac/build.sh --open     -> build, then open it
#
# Needs only the Xcode Command Line Tools (swift, codesign). The app is signed
# for this Mac only (ad hoc); to share it with others it would need a
# Developer ID signature and notarisation.
set -euo pipefail
cd "$(dirname "$0")"
WEB=..
APP="build/Old Possum.app"

swift build -c release
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/web/assets"
cp .build/release/OldPossum "$APP/Contents/MacOS/OldPossum"
cp Info.plist "$APP/Contents/Info.plist"
cp AppIcon.icns "$APP/Contents/Resources/AppIcon.icns"

# The web app: pages, styles, code and the art it uses (not the tools folder).
cp "$WEB/index.html" "$WEB/widget.html" "$WEB/manifest.webmanifest" "$APP/Contents/Resources/web/"
rsync -a --exclude '.DS_Store' "$WEB/css" "$WEB/js" "$APP/Contents/Resources/web/"
rsync -a --exclude '.DS_Store' "$WEB/assets/art" "$WEB/assets/icons" "$APP/Contents/Resources/web/assets/"

codesign --force --deep --sign - "$APP"
echo "Built $APP"
if [[ "${1:-}" == "--open" ]]; then open "$APP"; fi
