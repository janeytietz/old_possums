import AppKit

/// The countdown in the menu bar ("18:24", "Break 4:12", "Paused 18:24", or
/// "Old Possum" before you start), with a small menu. No emojis.
final class StatusBar: NSObject, NSMenuDelegate {
    private let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
    private var state = TimerState()
    private var ticker: Timer?
    private let toggleItem = NSMenuItem(title: "Start focus", action: nil, keyEquivalent: "")
    private let widgetItem = NSMenuItem(title: "Show the scene window", action: nil, keyEquivalent: "")
    private let phaseItem = NSMenuItem(title: "", action: nil, keyEquivalent: "")
    private let onShowApp: () -> Void
    private let onToggleWidget: () -> Void
    private let onToggle: () -> Void
    private let onSkip: () -> Void
    private let isWidgetOpen: () -> Bool

    init(onShowApp: @escaping () -> Void, onToggleWidget: @escaping () -> Void, onToggle: @escaping () -> Void,
         onSkip: @escaping () -> Void, isWidgetOpen: @escaping () -> Bool) {
        self.onShowApp = onShowApp
        self.onToggleWidget = onToggleWidget
        self.onToggle = onToggle
        self.onSkip = onSkip
        self.isWidgetOpen = isWidgetOpen
        super.init()

        let menu = NSMenu()
        menu.delegate = self
        phaseItem.isEnabled = false
        menu.addItem(phaseItem)
        menu.addItem(.separator())
        menu.addItem(button("Show Old Possum", #selector(showApp)))
        widgetItem.target = self
        widgetItem.action = #selector(toggleWidget)
        menu.addItem(widgetItem)
        menu.addItem(.separator())
        toggleItem.target = self
        toggleItem.action = #selector(toggle)
        menu.addItem(toggleItem)
        menu.addItem(button("Skip to the next phase", #selector(skip)))
        menu.addItem(.separator())
        menu.addItem(NSMenuItem(title: "Quit Old Possum", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))
        item.menu = menu
        item.button?.font = NSFont.monospacedDigitSystemFont(ofSize: NSFont.systemFontSize, weight: .medium)
        item.button?.toolTip = "Old Possum’s Book of Productivity"
        refresh()

        // Tick once a second so the countdown moves on its own between messages.
        ticker = Timer(timeInterval: 1, repeats: true) { [weak self] _ in self?.refresh() }
        RunLoop.main.add(ticker!, forMode: .common)
    }

    private func button(_ title: String, _ action: Selector) -> NSMenuItem {
        let menuItem = NSMenuItem(title: title, action: action, keyEquivalent: "")
        menuItem.target = self
        return menuItem
    }

    var title: String { item.button?.title ?? "" }

    func update(_ next: TimerState) {
        state = next
        refresh()
    }

    private func refresh() {
        item.button?.title = state.menuTitle
        phaseItem.title = state.running ? "\(state.phaseLabel), \(state.clock) left" : "\(state.phaseLabel), \(state.clock)"
        toggleItem.title = state.toggleLabel
    }

    func menuWillOpen(_ menu: NSMenu) {
        refresh()
        widgetItem.title = isWidgetOpen() ? "Hide the scene window" : "Show the scene window"
    }

    @objc private func showApp() { onShowApp() }
    @objc private func toggleWidget() { onToggleWidget() }
    @objc private func toggle() { onToggle() }
    @objc private func skip() { onSkip() }
}
