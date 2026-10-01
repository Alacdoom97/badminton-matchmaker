import { defineConfig } from 'vite';

// Relative assets work on both username.github.io/repo/ and root domains.
// Vite transforms JSX directly; a separate React/Babel plugin is not needed.
export default defineConfig({
  base: './',
  esbuild: { jsx: 'transform', jsxFactory: 'React.createElement', jsxFragment: 'React.Fragment' },
  build: { target: 'es2022', sourcemap: false },
  server: { port: 5173 },
});
