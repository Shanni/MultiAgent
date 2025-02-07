import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import Configuration from "openai";
import OpenAI from "openai";
import dotenv from 'dotenv';

// Load environment variables from a .env file (if you use one)
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // TODO: Change to the domain of the frontend
        methods: ["GET", "POST"]
    }
});

// --- OpenAI Setup ---
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OpenAI API key in environment variables.');
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://api.openai.com/v1",
});


// --- Socket.IO Setup ---
io.on('connection', (socket) => {
  console.log('Client connected');

  // Send a welcome message to the connected client
  socket.emit('output', 'What can I do for you today?');

  // Listen for input from the client
  socket.on('input', async (userMessage: string) => {
    console.log('Received input:', userMessage);
    try {
      // Call OpenAI's Chat Completion API
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          // You can include conversation context here if desired.
          { role: 'user', content: userMessage },
        ],
      });

      // Extract the reply from OpenAI's response
      const aiReply = completion.choices[0].message?.content;
      console.log('OpenAI reply:', aiReply);

      // Send the reply back to the client
      socket.emit('output', aiReply);
    } catch (error) {
      console.error('Error calling OpenAI API:', error);
      socket.emit('output', 'Sorry, there was an error processing your request.');
    }
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

// --- Start the Server ---
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
