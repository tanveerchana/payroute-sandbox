import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
import workspace from './api/workspace.js';
export default defineConfig(({mode})=>{
 const env=loadEnv(mode,process.cwd(),'');
 for(const name of ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY'])if(env[name]&&!process.env[name])process.env[name]=env[name];
 return {plugins:[react(),{name:'workspace-api-dev',configureServer(server){server.middlewares.use('/api/workspace',(req,res)=>{void workspace(req,res);});}}]};
});
