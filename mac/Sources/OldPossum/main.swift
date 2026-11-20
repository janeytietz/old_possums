import AppKit

// Old Possum's Book of Productivity, as a Mac app.
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()
