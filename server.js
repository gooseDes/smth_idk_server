import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 2567 });

const players = [];

function update() {
    for (const client of wss.clients) {
        client.send(JSON.stringify({'type': 'update', 'players': players}));
    }
}

setInterval(update, 1000 / 60);

wss.on("connection", (ws, req) => {
  console.log("Client connected");

  ws.on("message", (msg) => {
    const data = JSON.parse(msg);
    switch (data.type) {
        case 'join':
            const player = {
                name: data.name,
                position: null,
                rotation: null
            };
            players.push(player);
            console.log(`Player joined: ${player.name}`);
            break;
        case 'update':
            const playerToUpdate = players.find(p => p.name === data.name);
            if (playerToUpdate) {
                playerToUpdate.position = data.position;
                playerToUpdate.rotation = data.rotation;
                console.log(`Player updated: ${playerToUpdate.name}`);
            }
            break;
        case 'leave':
            const index = players.findIndex(p => p.name === data.name);
            if (index !== -1) {
                const removedPlayer = players.splice(index, 1)[0];
                console.log(`Player left: ${removedPlayer.name}`);
            }
            break;
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
  });
});