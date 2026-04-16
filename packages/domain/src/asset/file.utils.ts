import { createHash } from "crypto";
import { createReadStream, statSync } from "fs";
import { extname } from "path";

const MIME_MAP: Record<string, string> = {
  ".png":  "image/png",
  ".jpg":  "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif":  "image/gif",
  ".mp4":  "video/mp4",
  ".webm": "video/webm",
  ".mp3":  "audio/mpeg",
  ".wav":  "audio/wav",
  ".ogg":  "audio/ogg",
  ".txt":  "text/plain",
  ".json": "application/json",
};

export interface FileHashResult {
  hash: string;
  size: number;
  mimeType: string;
}

export async function computeFileHash(filePath: string): Promise<FileHashResult> {
  const stat = statSync(filePath);
  const size = stat.size;
  const ext = extname(filePath).toLowerCase();
  const mimeType = MIME_MAP[ext] ?? "application/octet-stream";

  const hash = await new Promise<string>((resolve, reject) => {
    const hasher = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hasher.update(chunk));
    stream.on("end", () => resolve(hasher.digest("hex")));
    stream.on("error", reject);
  });

  return { hash, size, mimeType };
}
