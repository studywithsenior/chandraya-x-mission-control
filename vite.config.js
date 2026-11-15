import { defineConfig } from 'vite';

export default defineConfig({
  // Expose only the public Supabase URL and publishable key to browser code.
  // Never add a Supabase service-role or other secret key here.
  envPrefix: ['VITE_', 'SUPABASE_', 'MQTT_']
});
