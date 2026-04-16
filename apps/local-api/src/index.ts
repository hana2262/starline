import path from "path";
import { buildServer } from "./server.js";

const PORT = Number(process.env["PORT"] ?? 3001);
const DB_PATH = process.env["DB_PATH"] ?? path.join(process.cwd(), "starline-dev.db");

const app = buildServer(DB_PATH);

app.listen({ port: PORT, host: "127.0.0.1" }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
});
