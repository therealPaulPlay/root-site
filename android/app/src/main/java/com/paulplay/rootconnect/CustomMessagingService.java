package com.paulplay.rootconnect;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.util.Base64;

import androidx.core.app.NotificationCompat;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URL;
import java.security.KeyFactory;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Arrays;
import java.util.Map;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;

public class CustomMessagingService extends FirebaseMessagingService {
    private static final String CHANNEL_ID = "root_events";

    @Override
    public void onMessageReceived(RemoteMessage msg) {
        Map<String, String> data = msg.getData();

        String title = data.getOrDefault("title", "Default");
        String body = data.getOrDefault("body", "");

        Bitmap image = null;
        if (data.get("imageUrl") != null && data.get("productId") != null) {
            image = fetchAndDecryptImage(data.get("imageUrl"), data.get("productId"));
        }

        showNotification(title, body, image, data, msg.getMessageId());
    }

    private Bitmap fetchAndDecryptImage(String imageUrl, String productId) {
        try {
            String json = getSharedPreferences(NativeStoragePlugin.PREFS_NAME, Context.MODE_PRIVATE)
                .getString(NativeStoragePlugin.STORAGE_KEY, null);
            if (json == null) return null;

            JSONArray products = new JSONArray(json);
            String privKeyB64 = null, pubKeyB64 = null, prevPrivKeyB64 = null;
            for (int i = 0; i < products.length(); i++) {
                JSONObject p = products.getJSONObject(i);
                if (productId.equals(p.getString("id"))) {
                    privKeyB64 = p.getString("devicePrivateKey");
                    pubKeyB64 = p.getString("productPublicKey");
                    if (!p.isNull("previousDevicePrivateKey")) {
                        prevPrivKeyB64 = p.getString("previousDevicePrivateKey");
                    }
                    break;
                }
            }
            if (privKeyB64 == null) return null;

            // Download
            byte[] encrypted;
            try (InputStream in = new URL(imageUrl).openStream();
                 ByteArrayOutputStream buf = new ByteArrayOutputStream()) {
                byte[] chunk = new byte[4096];
                int n;
                while ((n = in.read(chunk)) != -1) buf.write(chunk, 0, n);
                encrypted = buf.toByteArray();
            }

            // Try current key, fall back to previous key
            // Previous key is needed if the product lost connection or otherwise failed during key renewal
            byte[] decrypted = decryptAesGcm(encrypted, privKeyB64, pubKeyB64);
            if (decrypted == null && prevPrivKeyB64 != null) {
                decrypted = decryptAesGcm(encrypted, prevPrivKeyB64, pubKeyB64);
            }
            if (decrypted == null) return null;
            return BitmapFactory.decodeByteArray(decrypted, 0, decrypted.length);
        } catch (Exception e) {
            return null;
        }
    }

    private byte[] decryptAesGcm(byte[] ciphertext, String privKeyB64, String pubKeyB64) {
        try {
            return decryptAesGcmInner(ciphertext, privKeyB64, pubKeyB64);
        } catch (Exception e) {
            return null;
        }
    }

    private byte[] decryptAesGcmInner(byte[] ciphertext, String privKeyB64, String pubKeyB64) throws Exception {
        KeyFactory kf = KeyFactory.getInstance("EC");
        ECPrivateKey privKey = (ECPrivateKey) kf.generatePrivate(
            new PKCS8EncodedKeySpec(Base64.decode(privKeyB64, Base64.DEFAULT)));

        // X9.63 uncompressed public key -> X509 DER wrapper for P-256
        byte[] rawPub = Base64.decode(pubKeyB64, Base64.DEFAULT);
        byte[] x509Hdr = {0x30,0x59,0x30,0x13,0x06,0x07,0x2a,(byte)0x86,0x48,(byte)0xce,0x3d,0x02,0x01,
            0x06,0x08,0x2a,(byte)0x86,0x48,(byte)0xce,0x3d,0x03,0x01,0x07,0x03,0x42,0x00};
        byte[] x509 = new byte[x509Hdr.length + rawPub.length];
        System.arraycopy(x509Hdr, 0, x509, 0, x509Hdr.length);
        System.arraycopy(rawPub, 0, x509, x509Hdr.length, rawPub.length);
        ECPublicKey pubKey = (ECPublicKey) kf.generatePublic(new X509EncodedKeySpec(x509));

        // ECDH -> HKDF -> AES key
        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(privKey);
        ka.doPhase(pubKey, true);
        byte[] aesKey = hkdf(ka.generateSecret(), "root-privacy-encryption".getBytes(), 32);

        // AES-256-GCM: [nonce(12)][ciphertext+tag]
        if (ciphertext.length <= 12) return null;
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(aesKey, "AES"),
            new GCMParameterSpec(128, ciphertext, 0, 12));
        return c.doFinal(ciphertext, 12, ciphertext.length - 12);
    }

    /** HKDF-SHA256 with empty salt */
    private byte[] hkdf(byte[] ikm, byte[] info, int len) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(new byte[32], "HmacSHA256")); // extract with empty salt
        byte[] prk = mac.doFinal(ikm);
        mac.init(new SecretKeySpec(prk, "HmacSHA256")); // expand
        mac.update(info);
        mac.update((byte) 1);
        return Arrays.copyOf(mac.doFinal(), len);
    }

    private void showNotification(String title, String body, Bitmap image, Map<String, String> data, String messageId) {
        NotificationManager mgr = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            mgr.createNotificationChannel(new NotificationChannel(CHANNEL_ID, "Events", NotificationManager.IMPORTANCE_HIGH));
        }

        Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            for (Map.Entry<String, String> e : data.entrySet()) intent.putExtra(e.getKey(), e.getValue());
            // Capacitor's PushNotifications plugin checks for this key to fire pushNotificationActionPerformed
            if (messageId != null) intent.putExtra("google.message_id", messageId);
        }

        NotificationCompat.Builder b = new NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(PendingIntent.getActivity(this, 0, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));

        if (image != null) {
            b.setLargeIcon(image).setStyle(new NotificationCompat.BigPictureStyle()
                .bigPicture(image).bigLargeIcon((Bitmap) null));
        }

        mgr.notify((int) System.currentTimeMillis(), b.build());
    }
}
