export function decryptTextEffect(text, { speed = 30, scrambleSpeed = 60, cursor = '▋' } = {}) {
	return (node) => {
		let revealed = -1;
		let trailChar = null;

		const trails = ['_', '‥', ' ', '/.', '<', '%']; // ‥ is a single two-dot character (U+2025)
		const randomTrail = () => trails[Math.floor(Math.random() * trails.length)];

		function shuffle(arr) {
			if (arr.length <= 1) return arr;
			let result;
			do {
				result = arr.slice().sort(() => Math.random() - 0.5);
			} while (result.some((char, i) => char === arr[i]));
			return result;
		}

		function update() {
			let output = '';
			let position = 0;

			for (const segment of text.split(/(?=[ ,.])|(?<=[ ,.])/)) {
				if (' .,'.includes(segment)) {
					output += segment;
				} else {
					const revealedCount = Math.max(0, Math.min(segment.length, revealed - position));
					const shuffled = shuffle([...segment]);
					output += segment.slice(0, revealedCount) + shuffled.slice(0, segment.length - revealedCount).join('');
				}
				position += segment.length;
			}

			const cursorPos = Math.max(0, revealed);

			// Apply trail character before cursor (replace the character at cursorPos - 1)
			if (trailChar && cursorPos > 0 && cursorPos <= text.length) {
				output = output.slice(0, cursorPos - 1) + trailChar + output.slice(cursorPos);
			}

			if (cursorPos >= text.length) {
				node.innerHTML = output + `<span style="margin-left:-0.15em">${cursor}</span>`;
			} else {
				node.innerHTML =
					output.slice(0, cursorPos) +
					`<span style="margin-right:-0.15em">${cursor}</span>` +
					output.slice(cursorPos + 1);
			}
		}

		function reveal() {
			if (revealed > text.length) {
				clearInterval(scrambleInterval);
				clearInterval(revealInterval);
				node.textContent = text;
				return;
			}

			while (revealed < text.length && ' .'.includes(text[revealed])) {
				revealed++;
			}
			revealed++;
			trailChar = randomTrail();
		}

		const scrambleInterval = setInterval(update, scrambleSpeed);
		const revealInterval = setInterval(reveal, speed);

		return () => {
			clearInterval(scrambleInterval);
			clearInterval(revealInterval);
			node.textContent = text;
		};
	};
}
