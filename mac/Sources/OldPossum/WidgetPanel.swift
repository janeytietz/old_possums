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
