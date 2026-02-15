/**
 * Bluetooth LE utility for ROOT camera pairing
 * Uses @capacitor-community/bluetooth-le for cross-platform support
 */

import { BleClient } from "@capacitor-community/bluetooth-le";
import { Capacitor } from "@capacitor/core";
import { toast } from "svelte-sonner";
import { encode, decode } from "cbor-x";

const SERVICE_UUID = "a07498ca-ad5b-474e-940d-16f1fbe7e8cd";
const CHAR_UUIDS = {
	productModel: "fa3fd066-de2d-4a15-8e0c-4a8d45a847a5",
	productId: "8f3c4d5e-9a2b-4f1e-8d6c-7e5f4a3b2c1d",
	getCode: "51ff12bb-3ed8-46e5-b4f9-d64e2fec021b",
	scanQR: "2c8b0a8e-5f3d-4a9b-8e7c-1d4f6a8b9c2e",
	viewfinder: "3d9e1f7a-4b6c-5e8d-9f0a-1b2c3d4e5f6a",
	pair: "4fafc201-1fb5-459e-8fcc-c5c9c331914b",
	productPublicKey: "2d7c0e8f-5a3b-4c1d-8e6a-0f4b9d2c7e1a",
	wifiNetworks: "c2be2bc9-cee3-40ae-af50-f9959f25ee5b",
	wifiStatus: "d96453d5-1f49-47d6-8cbd-ac5547fc51a9",
	wifiConnect: "beb5483e-36e1-4688-b7f5-ea07361b26a8",
	relayStatus: "a9988b7b-e4ea-49b1-b9d1-548aeb0ec5ab",
	relaySet: "cba1d466-344c-4be3-ab3f-189f80dd7518"
};

let initialized = false;

export function bluetoothSupported() {
	return Capacitor.getPlatform() !== "web" || navigator.bluetooth;
}

async function ensureInitialized() {
	if (initialized) return;

	// Check for Bluetooth support on web
	if (!bluetoothSupported) throw new Error("Bluetooth is not supported in this environment!");

	await BleClient.initialize({ androidNeverForLocation: true });
	initialized = true;
}

export class Bluetooth {
	#deviceId = null;
	#deviceName = null;

	async scan() {
		await ensureInitialized();

		const device = await BleClient.requestDevice({
			namePrefix: 'ROOT',
			optionalServices: [SERVICE_UUID]
		});

		this.#deviceId = device.deviceId;
		this.#deviceName = device.name;

		return {
			id: device.deviceId,
			name: device.name
		};
	}

	async connect() {
		await ensureInitialized();
		if (!this.isConnected()) throw new Error("No device selected. Call scan() first!");

		await BleClient.connect(this.#deviceId, (deviceId) => {
			// On disconnect...
			this.#deviceId = null;
			this.#deviceName = null;
			toast.info("Bluetooth device disconnected.");
			console.log(`Bluetooth device ${deviceId} disconnected!`);
		});
	}

	async disconnect() {
		await ensureInitialized();
		if (this.isConnected()) await BleClient.disconnect(this.#deviceId);
		this.#deviceId = null;
		this.#deviceName = null;
	}

	isConnected() {
		return this.#deviceId !== null;
	}

	async read(charName) {
		await ensureInitialized();
		if (!this.isConnected()) throw new Error("No BLE device connected!");

		const uuid = CHAR_UUIDS[charName];
		if (!uuid) throw new Error(`Unknown characteristic: ${charName}`);

		const value = await BleClient.read(this.#deviceId, SERVICE_UUID, uuid);

		let response;
		try {
			response = decode(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
		} catch (e) {
			console.error("Failed to decode BLE response (read):", e);
			throw new Error("Invalid CBOR response from device!");
		}

		if (!response.success) throw new Error(response.error || "No error provided!");
		return response;
	}

	async write(charName, data) {
		await ensureInitialized();
		if (!this.isConnected()) throw new Error("No BLE device connected!");

		const uuid = CHAR_UUIDS[charName];
		if (!uuid) throw new Error(`Unknown characteristic: ${charName}`);

		const bytes = encode(data);
		const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

		await BleClient.write(this.#deviceId, SERVICE_UUID, uuid, dataView);
	}

	async writeAndRead(charName, data) {
		await this.write(charName, data);
		return await this.read(charName);
	}

	async writeAndPoll(charName, data, timeoutMs = 35000, pollIntervalMs = 1000) {
		await this.write(charName, data);

		const startTime = Date.now();
		while (Date.now() - startTime < timeoutMs) {
			await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));

			if (!this.isConnected()) throw new Error("Polling aborted as no BLE device is connected!");

			const response = await this.read(charName);
			if (response.status === "pending") continue;
			return response;
		}

		throw new Error("Operation timed out");
	}
}
