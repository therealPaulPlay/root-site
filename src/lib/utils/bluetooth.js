/**
 * Web Bluetooth API utility for ROOT camera pairing
 */

const SERVICE_UUID = 'a07498ca-ad5b-474e-940d-16f1fbe7e8cd';
const CHAR_UUIDS = {
  getCode: '51ff12bb-3ed8-46e5-b4f9-d64e2fec021b',
  scanQR: '2c8b0a8e-5f3d-4a9b-8e7c-1d4f6a8b9c2e',
  pair: '4fafc201-1fb5-459e-8fcc-c5c9c331914b',
  wifiNetworks: 'c2be2bc9-cee3-40ae-af50-f9959f25ee5b',
  wifi: 'beb5483e-36e1-4688-b7f5-ea07361b26a8',
  relay: 'cba1d466-344c-4be3-ab3f-189f80dd7518'
};

export class Bluetooth {
  #device = null;
  #server = null;
  #service = null;
  #chars = {};

  async scan() {
    if (!navigator.bluetooth) {
      throw new Error('Web Bluetooth not supported in this environment!');
    }
    this.#device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'ROOT-' }],
      optionalServices: [SERVICE_UUID]
    });
    return {
      id: this.#device.id,
      name: this.#device.name
    };
  }

  async connect() {
    if (!this.#device) throw new Error('Not initialized!');

    this.#server = await this.#device.gatt.connect();
    this.#service = await this.#server.getPrimaryService(SERVICE_UUID);

    for (const [name, uuid] of Object.entries(CHAR_UUIDS)) {
      this.#chars[name] = await this.#service.getCharacteristic(uuid);
    }
  }

  async disconnect() {
    if (this.#server?.connected) {
      this.#server.disconnect();
    }
    this.#device = null;
    this.#server = null;
    this.#service = null;
    this.#chars = {};
  }

  async read(charName) {
    if (!Object.keys(this.#chars).length) throw new Error('No BLE characteristics available!');
    const value = await this.#chars[charName].readValue();
    const text = new TextDecoder().decode(value);
    const response = JSON.parse(text);
    if (!response.success) throw new Error(response.error || "No error provided!");
    return response;
  }

  async write(charName, data) {
    if (!Object.keys(this.#chars).length) throw new Error('No BLE characteristics available!');
    const json = JSON.stringify(data);
    const bytes = new TextEncoder().encode(json);
    await this.#chars[charName].writeValue(bytes);
  }
}