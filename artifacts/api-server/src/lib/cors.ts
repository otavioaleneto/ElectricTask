import type { CorsOptions } from "cors";

function buildAllowedOrigins(): Set<string> {
  const origins = new Set<string>();

  const addHost = (host: string | undefined) => {
    const trimmed = host?.trim();
    if (trimmed) origins.add(`https://${trimmed}`);
  };

  // Replit dev/preview + Expo dev domains for this repl.
  addHost(process.env.REPLIT_DEV_DOMAIN);
  addHost(process.env.REPLIT_EXPO_DEV_DOMAIN);

  // REPLIT_DOMAINS is a comma-separated list that includes deployment domains
  // in production.
  for (const host of (process.env.REPLIT_DOMAINS ?? "").split(",")) {
    addHost(host);
  }

  // Explicit extra origins (comma-separated full origins, e.g. https://app.example.com).
  for (const origin of (process.env.ALLOWED_ORIGINS ?? "").split(",")) {
    const trimmed = origin.trim();
    if (trimmed) origins.add(trimmed);
  }

  return origins;
}

const allowedOrigins = buildAllowedOrigins();

function isLocalhostOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    // Requests with no Origin header (native mobile app, server-to-server,
    // curl) are not browser cross-site requests and are safe to allow.
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.has(origin) || isLocalhostOrigin(origin)) {
      callback(null, true);
      return;
    }
    // Disallowed origin: do not reflect it, so no
    // Access-Control-Allow-Origin header is sent for credentialed requests.
    callback(null, false);
  },
};
