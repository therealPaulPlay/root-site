import UIKit
import Capacitor

class CustomViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(NativeStoragePlugin())
    }
}
