import path from 'node:path';
import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const [repositoryOwner = '', repositoryName = ''] = (process.env.GITHUB_REPOSITORY ?? '').split('/');
const isUserSite = repositoryName.toLowerCase() === `${repositoryOwner.toLowerCase()}.github.io`;
const base = process.env.GITHUB_ACTIONS === 'true' && repositoryName && !isUserSite
  ? `/${repositoryName}/`
  : '/';

export default defineConfig({
  base,
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname),
      'next/dynamic': path.resolve(import.meta.dirname, 'src/next-dynamic.tsx'),
    },
  },
  build: {
    outDir: 'dist-github',
    emptyOutDir: true,
  },
});
