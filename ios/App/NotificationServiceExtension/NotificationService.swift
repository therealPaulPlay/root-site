import UserNotifications
import CryptoKit
import os.log

private let log = Logger(subsystem: "com.paulplay.rootconnect.NotificationServiceExtension", category: "decrypt")

class NotificationService: UNNotificationServiceExtension {
    private static let suiteName = "group.com.paulplay.rootconnect"
    private static let storageKey = "pairedProducts"

    var contentHandler: ((UNNotificationContent) -> Void)?
    var bestAttemptContent: UNMutableNotificationContent?

    override func didReceive(
        _ request: UNNotificationRequest,
        withContentHandler contentHandler: @escaping (UNNotificationContent) -> Void
    ) {
        self.contentHandler = contentHandler
        bestAttemptContent = request.content.mutableCopy() as? UNMutableNotificationContent

        guard let content = bestAttemptContent else {
            contentHandler(request.content)
            return
        }

        guard let imageUrl = request.content.userInfo["imageUrl"] as? String,
              let productId = request.content.userInfo["productId"] as? String,
              let url = URL(string: imageUrl),
              let keys = getProductKeys(productId: productId) else {
            log.error("Missing imageUrl, productId, or keys")
            contentHandler(content)
            return
        }

        // Download encrypted image, decrypt, and attach
        let task = URLSession.shared.dataTask(with: url) { data, _, error in
            defer { contentHandler(content) }
            if let error { log.error("Download failed: \(error.localizedDescription)") }
            guard let encryptedData = data, error == nil else { return }

            guard let decrypted = Self.decrypt(
                ciphertext: encryptedData,
                devicePrivateKeyBase64: keys.devicePrivateKey,
                productPublicKeyBase64: keys.productPublicKey
            ) else {
                log.error("Decryption failed (\(encryptedData.count) bytes)")
                return
            }

            let fileURL = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString + ".jpg")
            do {
                try decrypted.write(to: fileURL)
                let attachment = try UNNotificationAttachment(identifier: "image", url: fileURL)
                content.attachments = [attachment]
            } catch { log.error("Failed to attach image: \(error.localizedDescription)") }
        }
        task.resume()
    }

    override func serviceExtensionTimeWillExpire() {
        if let contentHandler, let bestAttemptContent {
            contentHandler(bestAttemptContent)
        }
    }

    // MARK: - Key Storage

    private struct ProductKeys {
        let productPublicKey: String
        let devicePrivateKey: String
    }

    private func getProductKeys(productId: String) -> ProductKeys? {
        guard let defaults = UserDefaults(suiteName: Self.suiteName),
              let json = defaults.string(forKey: Self.storageKey),
              let data = json.data(using: .utf8),
              let products = try? JSONSerialization.jsonObject(with: data) as? [[String: Any]],
              let product = products.first(where: { $0["id"] as? String == productId }),
              let publicKey = product["productPublicKey"] as? String,
              let privateKey = product["devicePrivateKey"] as? String else {
            return nil
        }
        return ProductKeys(productPublicKey: publicKey, devicePrivateKey: privateKey)
    }

    // MARK: - Decryption (P-256 ECDH + HKDF + AES-256-GCM)

    private static func decrypt(ciphertext: Data, devicePrivateKeyBase64: String, productPublicKeyBase64: String) -> Data? {
        guard let privateKeyData = Data(base64Encoded: devicePrivateKeyBase64),
              let publicKeyData = Data(base64Encoded: productPublicKeyBase64) else {
            return nil
        }

        // PKCS8 DER for P-256: the 32-byte raw scalar starts at offset 36
        guard privateKeyData.count >= 68,
              let privateKey = try? P256.KeyAgreement.PrivateKey(rawRepresentation: privateKeyData[36..<68]),
              let publicKey = try? P256.KeyAgreement.PublicKey(x963Representation: publicKeyData),
              let sharedSecret = try? privateKey.sharedSecretFromKeyAgreement(with: publicKey) else {
            return nil
        }

        // HKDF to derive AES key
        let derivedKey = sharedSecret.hkdfDerivedSymmetricKey(
            using: SHA256.self,
            salt: Data(),
            sharedInfo: "root-privacy-encryption".data(using: .utf8)!,
            outputByteCount: 32
        )

        // AES-256-GCM: [nonce(12)][ciphertext+tag(16)]
        guard ciphertext.count > 28 else { return nil }
        let nonce = ciphertext.prefix(12)
        let encrypted = ciphertext.suffix(from: 12)
        guard let sealedBox = try? AES.GCM.SealedBox(nonce: AES.GCM.Nonce(data: nonce),
                                                      ciphertext: encrypted.dropLast(16),
                                                      tag: encrypted.suffix(16)),
              let decrypted = try? AES.GCM.open(sealedBox, using: derivedKey) else {
            return nil
        }

        return decrypted
    }
}
