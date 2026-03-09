import Capacitor

@objc(NativeStoragePlugin)
public class NativeStoragePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeStoragePlugin"
    public let jsName = "NativeStorage"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "sync", returnType: CAPPluginReturnPromise)
    ]

    static let suiteName = "group.com.paulplay.rootconnect"
    static let storageKey = "pairedProducts"

    @objc func sync(_ call: CAPPluginCall) {
        guard let products = call.getString("products") else {
            call.reject("Missing products parameter")
            return
        }

        guard let defaults = UserDefaults(suiteName: NativeStoragePlugin.suiteName) else {
            call.reject("Failed to access App Group UserDefaults")
            return
        }

        defaults.set(products, forKey: NativeStoragePlugin.storageKey)
        call.resolve()
    }
}
