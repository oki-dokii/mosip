// Inji publishes signed 127.0.0.1 request/response/offer URLs. Preserve those exact
// bytes by forwarding only these two TCP ports inside the wallet's network namespace.
import net from 'node:net';
for (const port of [18081,18090]) net.createServer(client => {
  const peer=net.connect(port,'host.docker.internal');
  const end=()=>{client.destroy();peer.destroy();};
  client.on('error',end).on('close',end);
  peer.on('error',end).on('close',end);
  client.pipe(peer).pipe(client);
}).listen(port,'127.0.0.1');
