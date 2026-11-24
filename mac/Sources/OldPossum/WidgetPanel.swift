import AppKit
import WebKit

/// The scene window: a small panel that floats above other windows (and over
/// full-screen apps, on every desktop), showing widget.html. It gets the timer
/// state from the main window and sends its button presses back.
final class WidgetPanel: NSObject, NSWindowDelegate {
    private var panel: NSPanel?
    private var webView: WKWebView?
    private let makeWebView: (NSRect) -> WKWebView

    init(makeWebView: @escaping (NSRect) -> WKWebView) {
        self.makeWebView = makeWebView
    }

    var isOpen: Bool { panel?.isVisible ?? false }

    func toggle() {
        if isOpen { panel?.orderOut(nil) } else { show() }
    }

    private func show() {
        if panel == nil {
            let frame = NSRect(x: 0, y: 0, width: 480, height: 320)
            let p = NSPanel(contentRect: frame,
                            styleMask: [.titled, .closable, .resizable, .fullSizeContentView, .nonactivatingPanel],
                            backing: .buffered, defer: false)
            p.title = "Old Possum"
            p.titleVisibility = .hidden
            p.titlebarAppearsTransparent = true
            p.isMovableByWindowBackground = true
            p.level = .floating
            p.hidesOnDeactivate = false
            p.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
            p.minSize = NSSize(width: 260, height: 170)
            p.backgroundColor = NSColor(red: 0.945, green: 0.882, blue: 0.784, alpha: 1)
            p.isReleasedWhenClosed = false
            p.delegate = self
            let view = makeWebView(frame)
            p.contentView = view
            view.load(URLRequest(url: AppFiles.widget))
            p.setFrameAutosaveName("OldPossumScene")
            if !p.setFrameUsingName("OldPossumScene"), let screen = NSScreen.main {
                let v = screen.visibleFrame
                p.setFrameOrigin(NSPoint(x: v.maxX - frame.width - 24, y: v.maxY - frame.height - 24))
            }
            panel = p
            webView = view
        }
        panel?.orderFrontRegardless()
    }

    /// Where the page's buttons are, so a press anywhere else moves the window.
    func setHotspots(_ list: [[String: Any]]) {
        (webView as? DraggableWebView)?.hotspots = list.compactMap { r in
            guard let x = (r["x"] as? NSNumber)?.doubleValue, let y = (r["y"] as? NSNumber)?.doubleValue,
                  let w = (r["w"] as? NSNumber)?.doubleValue, let h = (r["h"] as? NSNumber)?.doubleValue else { return nil }
            return CGRect(x: x, y: y, width: w, height: h)
        }
    }

    /// Hand the latest timer state to the page (it counts down by itself).
    func push(_ state: TimerState) {
        guard let webView, !state.raw.isEmpty,
              let data = try? JSONSerialization.data(withJSONObject: state.raw),
              let json = String(data: data, encoding: .utf8) else { return }
        webView.evaluateJavaScript("window.possumWidget && window.possumWidget.update(\(json))")
    }

    /// For the self-test: run a bit of script in the scene window's page.
    func debugEval(_ js: String, _ done: @escaping (String) -> Void) {
        webView?.evaluateJavaScript(js) { result, error in done("\(result ?? error?.localizedDescription ?? "")") }
    }

    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        return false
    }
}

/// The scene window's web view. A web view takes every click for the page,
/// so the window could only be moved by its thin title strip; here a press
/// anywhere that isn't one of the page's buttons (reported by js/widget.js)
/// drags the whole window instead.
final class DraggableWebView: WKWebView {
    /// The page's buttons, in its own coordinates (CSS pixels from the top left).
    var hotspots: [CGRect] = []

    override func mouseDown(with event: NSEvent) {
        var p = convert(event.locationInWindow, from: nil)
        if !isFlipped { p.y = bounds.height - p.y }
        if hotspots.contains(where: { $0.insetBy(dx: -3, dy: -3).contains(p) }) {
            super.mouseDown(with: event)
        } else {
            window?.performDrag(with: event)
        }
    }

    /// The panel never becomes the active window, so the first press must count.
    override func acceptsFirstMouse(for event: NSEvent?) -> Bool { true }
}
