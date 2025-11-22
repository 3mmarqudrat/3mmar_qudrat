import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
// Fix: Explicitly import 'process' to make Node.js types available for 'process.cwd()'
// and resolve errors about missing 'node' type definitions.
import process from 'process';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    define: {
      // This makes the environment variable available to the client-side code.
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
    },
  }
})
