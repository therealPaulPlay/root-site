import Capacitor
import UIKit

@objc(AccessibilityPlugin)
public class AccessibilityPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AccessibilityPlugin"
    public let jsName = "Accessibility"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isVideoAutoplayEnabled", returnType: CAPPluginReturnPromise)
    ]

    // Reflects Settings > Accessibility > Motion > Auto-Play Video Previews
    @objc func isVideoAutoplayEnabled(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            call.resolve(["enabled": UIAccessibility.isVideoAutoplayEnabled])
        }
    }
}
