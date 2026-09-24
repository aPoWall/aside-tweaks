// Кто сейчас открывает ссылки и как поставить другого.
//
// macOS держит выбор браузера в LaunchServices, а не в файле настроек: правка
// com.apple.launchservices.secure.plist руками переживает до первой перерегистрации.
// Поэтому спрашиваем и ставим через сам LaunchServices.
//
//   swift default-browser.swift            показать текущего
//   swift default-browser.swift <bundleid> поставить этого

import Foundation
import CoreServices
import AppKit

let schemes = ["http", "https"]
let types = ["public.html", "public.xhtml"]

func current() {
    for s in schemes {
        let h = LSCopyDefaultHandlerForURLScheme(s as CFString)?.takeRetainedValue() as String? ?? "—"
        print("  \(s)  → \(h)")
    }
    for t in types {
        let h = LSCopyDefaultRoleHandlerForContentType(t as CFString, .all)?.takeRetainedValue() as String? ?? "—"
        print("  \(t) → \(h)")
    }
    if let u = URL(string: "https://example.com"),
       let app = NSWorkspace.shared.urlForApplication(toOpen: u) {
        print("  ссылку откроет: \(app.path)")
    }
}

let args = CommandLine.arguments
if args.count < 2 {
    print("сейчас:")
    current()
    exit(0)
}

let target = args[1]
var failed = false
for s in schemes {
    let st = LSSetDefaultHandlerForURLScheme(s as CFString, target as CFString)
    print("  set \(s) → \(st == 0 ? "ok" : "ошибка \(st)")")
    if st != 0 { failed = true }
}
for t in types {
    let st = LSSetDefaultRoleHandlerForContentType(t as CFString, .all, target as CFString)
    print("  set \(t) → \(st == 0 ? "ok" : "ошибка \(st)")")
    if st != 0 { failed = true }
}
print("стало:")
current()
exit(failed ? 1 : 0)
