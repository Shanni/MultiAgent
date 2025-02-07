import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import {funnyCryptoAdvisor, messages } from './services/openaiProvider';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { fetchCryptoNews } from './services/newsProvider';

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

// Create a namespace for chat
const chatNamespace = io.of('/chat');

// --- Socket.IO Setup ---
chatNamespace.on('connection', (socket) => {
  console.log('Client connected');

  // Send a welcome message to the connected client
  socket.emit('output', 'What can I do for you today?');

  // Listen for input from the client
  socket.on('input', async (userMessage: string) => {
    console.log('Received input:', userMessage);
    messages.push({ role: 'user', content: userMessage });

    try {
      // Call OpenAI's Chat Completion API
      const completion = await funnyCryptoAdvisor.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: messages as ChatCompletionMessageParam[],
        max_tokens: 150,
        temperature: 0.7,
      });

      // Extract the reply from OpenAI's response
      const aiReply = completion.choices[0].message?.content;
      messages.push({ role: 'assistant', content: String(aiReply) });

      console.log('AI reply:', aiReply);

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

// Add this after your app initialization
app.use(express.json());

// Add the news endpoint
app.get('/api/news-realtime', async (_req, res) => {
  try {
    const news = await fetchCryptoNews();
    res.json({ news });
  } catch (error) {
    console.error('Error in /api/news-realtime:', error);
    res.status(500).json({ 
      error: 'Failed to fetch news',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Also add a WebSocket event for real-time updates
const newsNamespace = io.of('/news');

newsNamespace.on('connection', (socket) => {
  console.log('Client connected to news feed');
  
  let newsInterval: NodeJS.Timeout;

  // Send initial news
  fetchCryptoNews()
    .then(news => socket.emit('news-update', news))
    .catch(error => socket.emit('error', error.message));

  // Set up periodic news updates
  newsInterval = setInterval(async () => {
    try {
      const news = await fetchCryptoNews();
      socket.emit('news-update', news);
    } catch (error) {
      socket.emit('error', error instanceof Error ? error.message : 'Failed to fetch news');
    }
  }, 60000); // Update every minute

  socket.on('disconnect', () => {
    console.log('Client disconnected from news feed');
    clearInterval(newsInterval);
  });
});

// --- Start the Server ---
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
