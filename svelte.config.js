import adapter from '@sveltejs/adapter-static';
const config = { kit: { adapter: adapter({ fallback: 'index.html' }) } }; // index.html fallback for SPA

export default config;
