![ROOT logo](static/images/logo.svg)

# ROOT (Website)

Made with [Svelte](https://svelte.dev/) and [Tailwindcss](https://tailwindcss.com/). [Remix](https://remixicon.com/) is used for most icons and [Shadcn-Svelte](https://www.shadcn-svelte.com/) for UI components.

## Developing

Start the dev server using `npm run dev` or use vite commands directly.

## Building for mobile

1. Add both platforms via `npm cap add ios && npm cap add android`.
2. Build for mobile using `npm run build:mobile`.
3. Generate the mobile assets (icons and splash screen images) via `npm run build:app-icons`.
