import express from "express";
import dotenv from "dotenv";
import { Server } from "socket.io";
import http from "http";
import cors from "cors";

dotenv.config();

const app = express();
app.use(cors);
const port = process.env.PORT;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

app.get("/", (_req, res) => {
  res.send("Express + TypeScript Server");
});

io.on("connection", (socket) => {
  console.log(`User Connected :${socket.id}`);

  // Triggered when a peer hits the join room button.
  socket.on("join", (roomName: string) => {
    const { rooms } = io.sockets.adapter;
    console.log("join", roomName, rooms);
    const room = rooms.get(roomName);
    console.log("room", room);
    // room == undefined when no such room exists.
    if (room === undefined) {
      socket.join(roomName);
      socket.emit("created");
    } else if (room.size === 1) {
      // room.size == 1 when one person is inside the room.
      socket.join(roomName);
      console.log("joining");
      socket.emit("joined");
    } else {
      // when there are already two people inside the room.
      socket.emit("full");
    }
    console.log(rooms);
  });

  // Triggered when the person who joined the room is ready to communicate.
  socket.on("ready", (roomName: string) => {
    socket.broadcast.to(roomName).emit("ready"); // Informs the other peer in the room.
  });

  // Triggered when server gets an icecandidate from a peer in the room.
  socket.on("ice-candidate", (candidate: RTCIceCandidate, roomName: string) => {
    console.log("candidate", candidate);
    socket.broadcast.to(roomName).emit("ice-candidate", candidate); // Sends Candidate to the other peer in the room.
  });

  // Triggered when server gets an offer from a peer in the room.
  socket.on("offer", (offer, roomName: string) => {
    socket.broadcast.to(roomName).emit("offer", offer); // Sends Offer to the other peer in the room.
  });

  // Triggered when server gets an answer from a peer in the room.
  socket.on("answer", (answer, roomName: string) => {
    socket.broadcast.to(roomName).emit("answer", answer); // Sends Answer to the other peer in the room.
  });

  socket.on("leave", (roomName: string) => {
    console.log("leaving");
    socket.leave(roomName);
    socket.broadcast.to(roomName).emit("leave");
  });
});

server.listen(port, () => {
  console.log(`[server]: Server is running at http://localhost:${port}`);
});
