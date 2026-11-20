// swift-tools-version:5.10
// Old Possum for the Mac: the web app in a native window, plus a countdown in
// the menu bar, macOS notifications and a floating scene window.
// Build the app with ./build.sh (no Xcode project needed).
import PackageDescription

let package = Package(
    name: "OldPossum",
    platforms: [.macOS(.v14)],
    targets: [
        .executableTarget(
            name: "OldPossum",
            path: "Sources/OldPossum",
            linkerSettings: [
                .linkedFramework("AppKit"),
                .linkedFramework("WebKit"),
                .linkedFramework("UserNotifications"),
            ]
        ),
    ]
)
