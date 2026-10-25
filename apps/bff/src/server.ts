import { createServer } from "node:http";
import { Server } from "socket.io";
import { buildApp } from "./app.js";
import { createRunRepository } from "./store.js";
import { withArchivedA1 } from "./archivedA1.js";

const port = Number(process.env.PORT ?? 4000);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
const baseRepository = createRunRepository();
const repository = process.env.PLAYGROUND_ARCHIVED_A1 === "true" ? withArchivedA1(baseRepository) : baseRepository;
let io: Server;
const app = buildApp(() => io, repository);
const httpServer = createServer(app);
io = new Server(httpServer, { cors: { origin: webOrigin }, path: "/socket.io" });

io.of("/runs").on("connection", (socket) => {
  socket.on("join", (runId: string) => socket.join(`run:${runId}`));
});

httpServer.listen(port, () => {
  console.log(`Playground BFF listening on http://localhost:${port} (${repository.storage} storage)`);
});

async function shutdown() {
  io.close();
  await repository.disconnect();
  httpServer.close(() => process.exit(0));
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());
