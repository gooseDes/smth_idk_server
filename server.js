import { WebSocketServer } from "ws";
import { FreeCamera, HavokPlugin, MeshBuilder, NullEngine, PhysicsAggregate, PhysicsShapeType, Scene, Vector3 } from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok"
import { JSDOM } from "jsdom";
import fetch from 'node-fetch';

const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;
global.self = global;
global.fetch = fetch;

const wss = new WebSocketServer({ port: 2567 });

function createActualPhysicObject(obj) {
    actual_physics_objects.push(new ActualPhysicObject(obj.type, obj.name, obj.position, obj.rotation, obj.velocity, obj.angularVelocity))
}

class PhysicObject {
    constructor(type, name, position, rotation, velocity=[0, 0, 0], angularVelocity=[0, 0, 0]) {
        this.type = type;
        this.name = name;
        this.position = position;
        this.rotation = rotation;
        this.velocity = velocity;
        this.angularVelocity = angularVelocity;
        this.id = actual_physics_objects.length;
        createActualPhysicObject(this);
    }
}

class ActualPhysicObject {
    constructor(type, name, position, rotation, velocity, angularVelocity) {
        this.type = type;
        this.name = name;
        this.position = position;
        this.rotation = rotation;
        this.velocity = velocity;
        this.angularVelocity = angularVelocity;
        switch (this.type) {
            case 'test_box':
                this.mesh = MeshBuilder.CreateBox(this.name, { size: 0.5 }, scene);
                this.mesh.position = Vector3.FromArray(this.position);
                this.mesh.rotation = Vector3.FromArray(this.rotation);
                this.aggregate = new PhysicsAggregate(this.mesh, PhysicsShapeType.BOX, { mass: 1 }, scene);
                this.aggregate.body.setLinearVelocity(Vector3.FromArray(this.velocity));
                this.aggregate.body.setAngularVelocity(Vector3.FromArray(this.angularVelocity));
        }
    }
}

const engine = new NullEngine();
const scene = new Scene(engine);

const havokInstance = await HavokPhysics({
    locateFile: (file) => {
        return 'https://github.com/gooseDes/smth_idk_server/raw/refs/heads/main/HavokPhysics.wasm';
    }
})
const havokPlugin = new HavokPlugin(true, havokInstance);
scene.enablePhysics(new Vector3(0, -9.81, 0), havokPlugin);
const camera = new FreeCamera("camera", new Vector3(0, 5, -10), scene);
scene.activeCamera = camera;

const ground = MeshBuilder.CreateGround("ground", { width: 50, height: 50 }, scene);
new PhysicsAggregate(ground, PhysicsShapeType.BOX, { mass: 0 }, scene);

const players = [];
const physics_objects = [];
const actual_physics_objects = [];

for (let i = 0; i < 50; i++) {
    physics_objects.push(new PhysicObject('test_box', `Box${i}`, [Math.random() * 20 - 10, Math.random() * 10 + 1, Math.random() * 20 - 10], [0, 0, 0]))
}

function update() {
    for (const client of wss.clients) {
        client.send(JSON.stringify({ 'type': 'update', 'players': players }));
    }
}

function send_physics() {
    physics_objects.forEach(object => {
        const actual = actual_physics_objects[object.id];
        object.position = actual.mesh.position.asArray();
        object.rotation = actual.mesh.rotation.asArray();
        object.velocity = actual.aggregate.body.getLinearVelocity();
        object.angularVelocity = actual.aggregate.body.getAngularVelocity();
    });
    for (const client of wss.clients) {
        client.send(JSON.stringify({ 'type': 'update_physics', 'objects': physics_objects }));
    }
}

setInterval(update, 1000 / 60);
setInterval(send_physics, 1000);
engine.runRenderLoop(() => { scene.render() });

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