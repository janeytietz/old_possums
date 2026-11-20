import Foundation

/// What the web app reports about the timer (js/native.js sends it on change).
/// While running, `endsAt` (ms since 1970) lets the menu bar count down on its
/// own without a message every second.
struct TimerState {
    var phase = "focus"            // focus / short / long
    var phaseLabel = "Focus"
    var running = false
    var remaining = 25 * 60_000.0  // ms, exact when paused
    var endsAt = 0.0               // ms since 1970, when running
    var toggleLabel = "Start focus"
    var raw: [String: Any] = [:]   // passed through to the scene window as-is

    init() {}

    init(_ body: [String: Any]) {
        raw = body
        phase = body["phase"] as? String ?? "focus"
        phaseLabel = body["phaseLabel"] as? String ?? "Focus"
        running = body["running"] as? Bool ?? false
        remaining = (body["remaining"] as? NSNumber)?.doubleValue ?? 0
        endsAt = (body["endsAt"] as? NSNumber)?.doubleValue ?? 0
        toggleLabel = body["toggleLabel"] as? String ?? (running ? "Pause" : "Start")
    }

    /// Milliseconds left right now.
    var left: Double {
        running && endsAt > 0 ? max(0, endsAt - Date().timeIntervalSince1970 * 1000) : remaining
    }

    /// "18:24", or "1:05:00" for long ones. No emojis, just the time.
    var clock: String {
        let total = Int((left / 1000).rounded(.up))
        let h = total / 3600, m = (total % 3600) / 60, s = total % 60
        return h > 0 ? String(format: "%d:%02d:%02d", h, m, s) : String(format: "%d:%02d", m, s)
    }

    /// What the menu bar shows.
    var menuTitle: String {
        if running { return phase == "focus" ? clock : "Break \(clock)" }
        let fresh = raw["fresh"] as? Bool ?? true
        return fresh ? "Old Possum" : "Paused \(clock)"
    }
}
