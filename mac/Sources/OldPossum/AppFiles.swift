import Foundation
import WebKit

/// Serves the web app's files from the app bundle at possum://app/...
/// (a custom scheme, so ES modules, fetch and localStorage behave like a website).
final class AppFiles: NSObject, WKURLSchemeHandler {
    static let scheme = "possum"
    static let home = URL(string: "possum://app/index.html")!
    static let widget = URL(string: "possum://app/widget.html")!

    private let root: URL = Bundle.main.resourceURL!.appendingPathComponent("web", isDirectory: true)

    private static let types: [String: String] = [
        "html": "text/html; charset=utf-8",
        "js": "text/javascript; charset=utf-8",
        "mjs": "text/javascript; charset=utf-8",
        "css": "text/css; charset=utf-8",
        "svg": "image/svg+xml",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "ico": "image/x-icon",
        "json": "application/json",
        "webmanifest": "application/manifest+json",
        "mp3": "audio/mpeg",
        "woff2": "font/woff2",
    ]

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        // Stay inside the bundled web folder.
        let file = root.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(root.standardizedFileURL.path),
              let data = try? Data(contentsOf: file) else {
            let missing = HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "text/plain"])!
            task.didReceive(missing)
            task.didReceive(Data("Not found".utf8))
            task.didFinish()
            return
        }
        let type = AppFiles.types[file.pathExtension.lowercased()] ?? "application/octet-stream"
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: [
            "Content-Type": type,
            "Content-Length": String(data.count),
            "Cache-Control": "no-cache",
        ])!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}
