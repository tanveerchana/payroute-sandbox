import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import workspace from './api/workspace.js';
import auth from './api/auth.js';
import team from './api/team.js';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  for (const name of ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'PORTFOLIO_BACKEND_KEY'])
    if (env[name] && !process.env[name]) process.env[name] = env[name];
  return {
    plugins: [
      react(),
      {
        name: 'workspace-api-dev',
        configureServer(server) {
          for (const [path, handler] of [
            ['/api/workspace', workspace],
            ['/api/auth', auth],
            ['/api/team', team],
          ] as const) {
            server.middlewares.use(path, (req, res) => {
              void handler(req, res);
            });
          }
        },
      },
    ],
  };
});
