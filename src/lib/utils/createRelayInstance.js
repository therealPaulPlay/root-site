import { RelayComm } from "./relaycomm";
import { OFFICIAL_RELAY_DOMAIN } from "$lib/config";

export function createRelayInstance() {
	const relayDomain = localStorage.getItem("relayDomain") || OFFICIAL_RELAY_DOMAIN;
	const deviceId = localStorage.getItem("deviceId");
	if (!deviceId) throw new Error("No device ID set - cannot connect to relay");

	return new RelayComm(relayDomain, deviceId);
}
