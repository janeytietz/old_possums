import AppKit
import WebKit

/// Holds the main window (the web app), the menu-bar countdown, the floating
/// scene window and notifications, and carries messages between them.
///
/// Web app -> Mac (window.webkit.messageHandlers.possum.postMessage):
///   { type: "state", ... }            timer state (see TimerState)
///   { type: "notify", title, body }   a notification, sent while the app isn't in front
///   { type: "askNotify" }             ask macOS for permission to notify
///   { type: "widget" }                show or hide the scene window
///   { type: "command", name }         from the scene window: toggle / skip / showMain
///   { type: "widgetReady" }           the scene window's page is ready for the state
///   { type: "sortNotes", id, notes, projects, today }   sort notes on this Mac (Apple Intelligence);
///                                     answered with window.possumNative.sorted(id, ok, jsonOrMessage)
/// Mac -> web app: window.possumNative.command("toggle" | "skip" | "completeTask", id)
final class AppDelegate: NSObject, NSApplicationDelegate, WKScriptMessageHandler, WKNavigationDelegate, WKUIDelegate, NSWindowDelegate {
    private var window: NSWindow!
    private var webView: WKWebView!
    private let files = AppFiles()
    private var statusBar: StatusBar!
    private var widget: WidgetPanel!
    private let notifier = Notifier()
    private var state = TimerState()
    /// `OldPossum --selftest`: report what the bridge sees, drive the timer from
    /// the Mac side, open the scene window, then quit. Used to check a build.
    private let selfTest = CommandLine.arguments.contains("--selftest")

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildMenu()
        notifier.setUp { [weak self] in self?.showMain() }

        webView = makeWebView(frame: NSRect(x: 0, y: 0, width: 1280, height: 820))
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1280, height: 820),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable, .fullSizeContentView],
                          backing: .buffered, defer: false)
        window.title = "Old Possum’s Book of Productivity"
        window.titlebarAppearsTransparent = true
        window.backgroundColor = NSColor(red: 0.945, green: 0.882, blue: 0.784, alpha: 1)
        window.minSize = NSSize(width: 900, height: 620)
        window.contentView = webView
        window.delegate = self
        window.isReleasedWhenClosed = false
        window.setFrameAutosaveName("OldPossumMain")
        if !window.setFrameUsingName("OldPossumMain") { window.center() }
        window.makeKeyAndOrderFront(nil)
        webView.load(URLRequest(url: AppFiles.home))

        statusBar = StatusBar(
            onShowApp: { [weak self] in self?.showMain() },
            onToggleWidget: { [weak self] in self?.widget.toggle() },
            onToggle: { [weak self] in self?.command("toggle") },
            onSkip: { [weak self] in self?.command("skip") },
            isWidgetOpen: { [weak self] in self?.widget.isOpen ?? false }
        )
        widget = WidgetPanel(makeWebView: { [weak self] frame in self!.makeWebView(frame: frame, draggable: true) })
        NSApp.activate(ignoringOtherApps: true)
    }

    /// One web view setup for both windows: our files, the bridge, and a flag
    /// (window.possumMac) so the web app knows it's inside the Mac app.
    /// The scene window's is `draggable`: press anywhere but a button to move it.
    private func makeWebView(frame: NSRect, draggable: Bool = false) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(files, forURLScheme: AppFiles.scheme)
        config.websiteDataStore = .default()
        let content = WKUserContentController()
        content.add(WeakMessageHandler(self), name: "possum")
        let ai = OnDeviceSorter.status
        let aiJSON = (try? JSONSerialization.data(withJSONObject: ["available": ai.available, "reason": ai.reason])).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
        content.addUserScript(WKUserScript(source: "window.possumMac = { version: 1, onDeviceAI: \(aiJSON) };", injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController = content
        let view = draggable ? DraggableWebView(frame: frame, configuration: config) : WKWebView(frame: frame, configuration: config)
        view.navigationDelegate = self
        view.uiDelegate = self
        view.isInspectable = true
        view.setValue(false, forKey: "drawsBackground")
        return view
    }

    // MARK: Messages from the web app

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let type = body["type"] as? String else { return }
        switch type {
        case "state":
            state = TimerState(body)
            if selfTest { print("state: \(state.phaseLabel) running=\(state.running) menu=\"\(state.menuTitle)\" toggle=\"\(state.toggleLabel)\" beast=\(body["beast"] ?? "")") }
            statusBar.update(state)
            widget.push(state)
        case "notify":
            notifier.post(title: body["title"] as? String ?? "Old Possum", body: body["body"] as? String ?? "")
        case "askNotify":
            notifier.ask()
        case "widgetReady":
            widget.push(state)
        case "widgetHotspots":
            widget.setHotspots(body["rects"] as? [[String: Any]] ?? [])
            if selfTest { print("scene window buttons (the rest drags): \(body["rects"] ?? [])") }
        case "sortNotes":
            sortNotes(body)
        case "widget":
            widget.toggle()
            if widget.isOpen { widget.push(state) }
        case "command":
            let name = body["name"] as? String ?? ""
            if name == "showMain" { showMain() } else { command(name, id: body["id"] as? String) }
        default:
            break
        }
    }

    /// Sort notes with the on-device model and hand the result back to the page.
    private func sortNotes(_ body: [String: Any]) {
        let id = (body["id"] as? NSNumber)?.intValue ?? 0
        let notes = body["notes"] as? String ?? ""
        let projects = body["projects"] as? [String] ?? []
        let today = body["today"] as? String ?? ""
        Task { @MainActor in
            var ok = false
            var payload = ""
            if #available(macOS 26.0, *) {
                do {
                    payload = try await OnDeviceSorter.sort(notes: notes, projects: projects, today: today)
                    ok = true
                } catch let failure as SortFailure {
                    payload = failure.message
                } catch {
                    payload = "Sorting on this Mac didn’t work. Try again, or sort another way."
                }
            } else {
                payload = OnDeviceSorter.status.reason
            }
            if self.selfTest { print("sorted on this Mac: ok=\(ok) \(payload.prefix(400))") }
            let arg = (try? JSONSerialization.data(withJSONObject: [payload], options: [.fragmentsAllowed])).flatMap { String(data: $0, encoding: .utf8) } ?? "[\"\"]"
            _ = try? await self.webView.evaluateJavaScript("window.possumNative && window.possumNative.sorted(\(id), \(ok), \(arg)[0])")
        }
    }

    /// Ask the web app to toggle or skip (it owns the timer).
    /// Ask the main window to do something. `completeTask` ticks off the task the
    /// scene window shows; its id must look like one of ours (letters and digits).
    private func command(_ name: String, id: String? = nil) {
        guard ["toggle", "skip", "completeTask"].contains(name) else { return }
        var arg = ""
        if name == "completeTask" {
            guard let id, (1...24).contains(id.count), id.allSatisfy({ $0.isASCII && ($0.isLetter || $0.isNumber) }) else { return }
            arg = ", '\(id)'"
        }
        webView.evaluateJavaScript("window.possumNative && window.possumNative.command('\(name)'\(arg))")
    }

    private func showMain() {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    // MARK: Links open in the browser; the app stays on its own files

    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = action.request.url, url.scheme == "http" || url.scheme == "https",
           action.navigationType == .linkActivated || action.targetFrame == nil {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { NSWorkspace.shared.open(url) }
        return nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if webView !== self.webView { widget.push(state); return }
        if selfTest { runSelfTest() }
    }

    private func runSelfTest() {
        print("loaded: \(webView.url?.absoluteString ?? "")")
        let ai = OnDeviceSorter.status
        print("on-device AI: available=\(ai.available) \(ai.reason)")
        if ai.available {
            // The whole path: page -> Mac app -> Apple's model -> page, with made-up notes.
            let script = "const m = await import('./js/mac-sort.js'); const out = await m.sortOnThisMac('email the printer friday\\nmaybe a reading corner?\\nwriting: draft the opening by the 27th', [{ id: 'w', name: 'Writing' }]); return JSON.stringify(out.map((x) => [x.kind, x.title, x.due, x.projectId]));"
            webView.callAsyncJavaScript(script, arguments: [:], in: nil, in: .page) { result in
                switch result {
                case .success(let value): print("page got suggestions: \(value)")
                case .failure(let error): print("page sort failed: \(error.localizedDescription)")
                }
            }
        }
        let after = { (s: Double, f: @escaping () -> Void) in DispatchQueue.main.asyncAfter(deadline: .now() + s, execute: f) }
        webView.evaluateJavaScript("[document.title, !!window.possumMac, document.querySelector('.brand')?.textContent, document.querySelector('#time')?.textContent].join(' | ')") { result, error in
            print("page: \(result ?? error?.localizedDescription ?? "")")
        }
        after(2) { print("menu bar before: \"\(self.statusBar.title)\""); self.command("toggle") }
        after(5) {
            print("menu bar while focusing: \"\(self.statusBar.title)\"")
            self.widget.toggle()
        }
        after(8) {
            print("scene window open: \(self.widget.isOpen)")
            self.widget.debugEval("[document.getElementById('wPhase').textContent, document.getElementById('wTime').textContent, document.getElementById('wToggle').textContent, document.querySelector('#wBuddy g.beast')?.getAttribute('class')].join(' | ')") { print("scene window: \($0)") }
            self.command("toggle")
        }
        after(10) {
            print("menu bar after pause: \"\(self.statusBar.title)\"")
            // Leave the timer as it was found: back to a fresh 25:00, scene window closed.
            self.webView.evaluateJavaScript("document.querySelector('#resetBtn').click()")
            if self.widget.isOpen { self.widget.toggle() }
        }
        after(12) { print("menu bar after reset: \"\(self.statusBar.title)\"") }
        after(ai.available ? 40 : 13) { NSApp.terminate(nil) }
    }

    // MARK: Window and app

    /// Closing the window keeps the app (and the menu-bar countdown) running.
    func windowShouldClose(_ sender: NSWindow) -> Bool {
        sender.orderOut(nil)
        return false
    }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
        showMain()
        return true
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    /// App menu, Edit (so copy and paste work in the page) and Window.
    private func buildMenu() {
        let main = NSMenu()
        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "About Old Possum", action: #selector(NSApplication.orderFrontStandardAboutPanel(_:)), keyEquivalent: "")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Hide Old Possum", action: #selector(NSApplication.hide(_:)), keyEquivalent: "h")
        appMenu.addItem(.separator())
        appMenu.addItem(withTitle: "Quit Old Possum", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        main.addItem(appItem)

        let editItem = NSMenuItem()
        let edit = NSMenu(title: "Edit")
        edit.addItem(withTitle: "Undo", action: Selector(("undo:")), keyEquivalent: "z")
        edit.addItem(withTitle: "Redo", action: Selector(("redo:")), keyEquivalent: "Z")
        edit.addItem(.separator())
        edit.addItem(withTitle: "Cut", action: #selector(NSText.cut(_:)), keyEquivalent: "x")
        edit.addItem(withTitle: "Copy", action: #selector(NSText.copy(_:)), keyEquivalent: "c")
        edit.addItem(withTitle: "Paste", action: #selector(NSText.paste(_:)), keyEquivalent: "v")
        edit.addItem(withTitle: "Select All", action: #selector(NSText.selectAll(_:)), keyEquivalent: "a")
        editItem.submenu = edit
        main.addItem(editItem)

        let windowItem = NSMenuItem()
        let windows = NSMenu(title: "Window")
        windows.addItem(withTitle: "Minimize", action: #selector(NSWindow.miniaturize(_:)), keyEquivalent: "m")
        windows.addItem(withTitle: "Close", action: #selector(NSWindow.performClose(_:)), keyEquivalent: "w")
        windowItem.submenu = windows
        main.addItem(windowItem)
        NSApp.mainMenu = main
        NSApp.windowsMenu = windows
    }
}

/// WKUserContentController holds its handlers strongly; this breaks the cycle.
final class WeakMessageHandler: NSObject, WKScriptMessageHandler {
    private weak var target: WKScriptMessageHandler?
    init(_ target: WKScriptMessageHandler) { self.target = target }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        target?.userContentController(controller, didReceive: message)
    }
}
