import { MediaQuery } from "svelte/reactivity";
import { page } from "$app/state";
import { browser } from "$app/environment";

export const ThemePreference = { LIGHT: "light", DARK: "dark", SYSTEM: "system" };

function getInitialPreference() {
	if (!browser) return ThemePreference.SYSTEM;
	const stored = localStorage.getItem("theme");
	return Object.values(ThemePreference).includes(stored) ? stored : ThemePreference.SYSTEM;
}

let preference = $state(getInitialPreference());
let userPrefersDark = new MediaQuery("prefers-color-scheme: dark");

let isDark = $derived(
	preference === ThemePreference.DARK ||
		(preference === ThemePreference.SYSTEM && userPrefersDark.current)
);

if (browser) {
	$effect.root(() => {
		$effect(() => {
			if (!page.url) return;
			if (page.url.pathname.startsWith("/connect")) {
				document.documentElement.classList.toggle("dark", isDark);
				document.documentElement.style.colorScheme = isDark ? "dark" : "light";
			} else {
				document.documentElement.classList.remove("dark");
				document.documentElement.style.colorScheme = "light";
			}
		});
	});
}

export const theme = {
	get preference() {
		return preference;
	},
	set preference(value) {
		preference = value;
		if (browser) {
			if (value === ThemePreference.SYSTEM) localStorage.removeItem("theme");
			else localStorage.setItem("theme", value);
		}
	},
	get current() {
		return isDark ? "dark" : "light";
	},
};
