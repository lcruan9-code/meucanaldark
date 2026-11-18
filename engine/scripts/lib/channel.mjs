import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "../..");

export function loadChannel(channelId = "invisible-systems") {
  const channelPath = path.resolve(ROOT, "channels", channelId, "channel.json");
  if (!fs.existsSync(channelPath)) {
    throw new Error(`Channel config not found at: ${channelPath}`);
  }
  return JSON.parse(fs.readFileSync(channelPath, "utf-8"));
}
