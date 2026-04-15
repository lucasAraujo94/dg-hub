import { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.dghub.app",
  appName: "DG Hub",
  webDir: "dist/public",
  server: {
    url: "https://app.dggames.online",
    cleartext: false,
    androidScheme: "https",
  },
};

export default config;
