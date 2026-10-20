import { createServer } from "node:http";
import { Server } from "socket.io";
import { buildApp } from "./app.js";

const port = Number(process.env.PORT ?? 4000);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:5173";
let io: Server;
const app = buildApp(() => io);
const httpServer = createServer(app);
io = new Server(httpServer, { cors: { origin: webOrigin }, path: "/socket.io" });

io.of("/runs").on("connection", (socket) => {
  socket.on("join", (runId: string) => socket.join(`run:${runId}`));
});

httpServer.listen(port, () => {
  console.log(`Playground BFF listening on http://localhost:${port}`);
});
