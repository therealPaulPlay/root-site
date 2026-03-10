import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { page } from "$app/state";

export function initializeBackGestureHandler() {
	if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android" || typeof window === "undefined") return;

	const listener = App.addListener("backButton", ({ canGoBack }) => {
		const currentPath = page.url.pathname;

		// Define paths where back should exit the app
		const exitPaths = ["/connect"];

		if (exitPaths.includes(currentPath)) {
			App.exitApp();
			return;
		}

		// For other pages, use browser-like navigation
		if (canGoBack) window.history.back();
	});

	return () => listener.then((h) => h.remove());
}
