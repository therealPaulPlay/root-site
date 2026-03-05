import { SvelteMap } from "svelte/reactivity";

export class LoadingState {
	#map = new SvelteMap();
	#waiters = [];

	set(key, value) {
		if (value) this.#map.set(key, true);
		else {
			this.#map.delete(key);
			this.#flush(key);
		}
	}

	is(key) {
		return Boolean(this.#map.get(key));
	}

	any(...keys) {
		return keys.some((k) => this.#map.has(k));
	}

	none(...keys) {
		return keys.every((k) => !this.#map.has(k));
	}

	promise(...keys) {
		if (this.none(...keys)) return Promise.resolve();
		return new Promise((resolve) => {
			this.#waiters.push({ keys, resolve });
		});
	}

	#flush(changedKey) {
		this.#waiters = this.#waiters.filter(({ keys, resolve }) => {
			if (!keys.includes(changedKey)) return true;
			if (keys.every((k) => !this.#map.has(k))) {
				resolve();
				return false;
			}
			return true;
		});
	}
}
