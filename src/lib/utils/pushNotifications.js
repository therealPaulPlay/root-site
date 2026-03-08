import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { toast } from "svelte-sonner";

const isNative = () => Capacitor.isNativePlatform();

// Request permission and get FCM token
// Returns the token string, or null if unavailable (e.g. web browser, denied permission)
export async function getFCMToken() {
	if (!isNative()) return null;

	const permission = await PushNotifications.requestPermissions();
	if (permission.receive !== "granted") {
		toast.error("Please allow notifications for ROOT Connect in your device's settings.");
		return null;
	}

	return new Promise(async (resolve) => {
		const timeout = setTimeout(() => {
			toast.error("Push registration timed out.");
			resolve(null);
		}, 10_000);

		await PushNotifications.addListener("registration", (token) => {
			clearTimeout(timeout);
			resolve(token.value);
		});
		await PushNotifications.addListener("registrationError", (error) => {
			clearTimeout(timeout);
			toast.error("Push registration failed: " + (error?.message || error));
			resolve(null);
		});
		await PushNotifications.register();
	});
}

// Listen for notification taps (when user clicks a notification)
export function onNotificationTap(callback) {
	if (!isNative()) return () => {};

	const listener = PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
		const data = notification.notification?.data || {};
		callback(data);
	});

	return () => listener.then((l) => l.remove());
}