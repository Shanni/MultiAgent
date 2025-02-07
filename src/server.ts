import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (e.g., your React build) from a folder named "public"
app.use(express.static('public'));

// When a client connects, set up socket listeners
io.on('connection', (socket) => {
  console.log('Client connected');

  // Optionally, send a welcome message to the connected client
  socket.emit('message', 'Connected to server');

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Spawn your long-running TypeScript script
// Here we use "ts-node" to run a TypeScript file directly
const childProcess: ChildProcessWithoutNullStreams = spawn('ts-node', ['src/index.ts']);

// Listen for data coming from the child process's stdout
childProcess.stdout.on('data', (data: Buffer) => {
  const message: string = data.toString();
  console.log('From script:', message);

  // Broadcast the message to all connected clients via Socket.IO
  io.emit('message', message);
});

// Listen for errors from the child process's stderr
childProcess.stderr.on('data', (data: Buffer) => {
  const errorMsg: string = data.toString();
  console.error('Script error:', errorMsg);
  io.emit('error', errorMsg);
});

// Handle the close event for the child process
childProcess.on('close', (code: number) => {
  console.log(`Child process exited with code ${code}`);
  io.emit('message', `Script finished with code ${code}`);
});
