import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUILD_DIR = path.join(__dirname, "..", "build");

// Allowlisted subdirectories in build/images/ (loose files are always kept)
const KEEP_IMAGE_DIRS = ["connect", "icons", "legal", "source-code"];

if (!fs.existsSync(BUILD_DIR)) {
	console.error(`Build directory not found: ${BUILD_DIR}`);
	process.exit(1);
}

let removed = 0;

const imagesDir = path.join(BUILD_DIR, "images");
if (fs.existsSync(imagesDir)) {
	for (const entry of fs.readdirSync(imagesDir, { withFileTypes: true })) {
		if (entry.isDirectory() && !KEEP_IMAGE_DIRS.includes(entry.name)) {
			fs.rmSync(path.join(imagesDir, entry.name), { recursive: true });
			console.log(`Removed: images/${entry.name}/`);
			removed++;
		}
	}
}

console.log(`\nMobile build cleanup complete. Removed ${removed} items.`);
