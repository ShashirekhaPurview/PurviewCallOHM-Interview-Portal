import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
  },
  optimizeDeps: {
    include: [
      '@uiw/react-codemirror',
      '@uiw/codemirror-theme-vscode',
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/language',
      '@codemirror/legacy-modes/mode/ruby',
      '@codemirror/legacy-modes/mode/lua',
      '@codemirror/legacy-modes/mode/shell',
      '@codemirror/legacy-modes/mode/clike',
    ],
  },
  build: {
    rollupOptions: {
      output: {
        // Force ALL CodeMirror/Lezer modules into ONE chunk. Splitting them across
        // chunks creates a circular reference that triggers a "Cannot access 'x'
        // before initialization" TDZ error at runtime.
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('@elevenlabs')) return 'vendor-elevenlabs'
          if (
            id.includes('@codemirror') ||
            id.includes('@uiw/react-codemirror') ||
            id.includes('@uiw/codemirror') ||
            id.includes('@lezer') ||
            id.includes('style-mod') ||
            id.includes('w3c-keyname') ||
            id.includes('crelt')
          ) {
            return 'vendor-codemirror'
          }
        },
      },
    },
  },
})
