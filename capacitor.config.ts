import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.dghub.app",
  appName: "DG Hub",
  webDir: "dist/public",
  server: {
    androidScheme: "https",
  },
};

export default config;
