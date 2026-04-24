import { SvelteMap } from "svelte/reactivity";

// Ref-counted: concurrent set(key, true) calls all need matching set(key, false) before
// the key is considered idle, so stale finishers can't flip the flag off mid-load
export class LoadingState {
	#map = new SvelteMap();
	#waiters = [];

	set(key, value) {
		const count = this.#map.get(key) ?? 0;
		if (value) this.#map.set(key, count + 1);
		else {
			if (count <= 1) {
				this.#map.delete(key);
				this.#flush(key);
			} else this.#map.set(key, count - 1);
		}
	}

	is(key) {
		return this.#map.has(key);
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
