import UIKit
import Capacitor

class CustomViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(NativeStoragePlugin())
        bridge?.webView?.allowsBackForwardNavigationGestures = true
        // Disable the forward (right-edge) swipe gesture
        bridge?.webView?.gestureRecognizers?
            .compactMap { $0 as? UIScreenEdgePanGestureRecognizer }
            .filter { $0.edges == .right }
            .forEach { $0.isEnabled = false }
    }
}
