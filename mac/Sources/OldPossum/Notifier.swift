import Foundation
import UserNotifications

/// macOS notifications for phase ends and reminders (the web app decides when;
/// it only asks while the app isn't in front, and never during your focus for
/// things that wait until the break). Plain words, no emojis.
final class Notifier: NSObject, UNUserNotificationCenterDelegate {
    private let center = UNUserNotificationCenter.current()
    private var onOpen: () -> Void = {}

    func setUp(onOpen: @escaping () -> Void) {
        self.onOpen = onOpen
        center.delegate = self
    }

    func ask() {
        center.requestAuthorization(options: [.alert, .sound]) { _, _ in }
    }

    func post(title: String, body: String) {
        center.getNotificationSettings { [weak self] settings in
            guard let self else { return }
            if settings.authorizationStatus == .notDetermined {
                self.center.requestAuthorization(options: [.alert, .sound]) { granted, _ in
                    if granted { self.send(title: title, body: body) }
                }
            } else if settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional {
                self.send(title: title, body: body)
            }
        }
    }

    private func send(title: String, body: String) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        center.add(UNNotificationRequest(identifier: UUID().uuidString, content: content, trigger: nil))
    }

    // Show them even if the app happens to be in front, and open the app on a click.
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification,
                                withCompletionHandler completion: @escaping (UNNotificationPresentationOptions) -> Void) {
        completion([.banner, .sound])
    }

    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
                                withCompletionHandler completion: @escaping () -> Void) {
        DispatchQueue.main.async { self.onOpen() }
        completion()
    }
}
