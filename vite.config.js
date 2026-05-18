// SPDX-License-Identifier: MIT
// Copyright (c) 2026 AsO
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const pkg = JSON.parse(readFileSync(resolve('./package.json'), 'utf-8'))

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  define: {
    // Expose root package version
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version),
  },
  server: {
    port: 5173,
    strictPort: true,   // fail fast if port 5173 is taken – never silently shift to another port
  },
  build: {
    outDir: 'dist',
  },
})
