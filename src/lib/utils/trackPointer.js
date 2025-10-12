export function handlePointerMove(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    event.currentTarget.style.setProperty("--pointer-x", `${x}px`);
    event.currentTarget.style.setProperty("--pointer-y", `${y}px`);
}

export function resetPointerMove() {
    event.currentTarget.style.setProperty("--pointer-x", `-1000px`);
    event.currentTarget.style.setProperty("--pointer-y", `-1000px`);
}