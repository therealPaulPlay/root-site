export function base64ToBlob(base64, type) {
    const bytes = atob(base64);
    const byteArray = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) byteArray[i] = bytes.charCodeAt(i);
    return new Blob([byteArray], { type });
}