import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import {funnyCryptoAdvisor, messages } from './services/openaiProvider';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { fetchCryptoNews } from './services/newsProvider';
import { runMarketAnalysis } from './services/agentProvider';
import { CoinbaseTradeAgent } from './services/coinbaseAgentkitProvider';
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

// // Create a namespace for market analysis
// const analysisNamespace = io.of('/news-based-analysis');

// analysisNamespace.on('connection', (socket) => {
//   console.log('Client connected to market analysis');

//   let analysisInterval: NodeJS.Timeout;

//   // Function to run and emit analysis
//   async function performAnalysis() {
//     try {
//       const analysis = await runMarketAnalysis();
//       socket.emit('analysis-update', {
//         timestamp: new Date().toISOString(),
//         analysis
//       });
//     } catch (error) {
//       socket.emit('error', {
//         message: error instanceof Error ? error.message : 'Analysis failed',
//         timestamp: new Date().toISOString()
//       });
//     }
//   }

//   // Initial analysis
//   performAnalysis();

//   // Set up periodic analysis updates
//   analysisInterval = setInterval(performAnalysis, 5 * 60 * 1000); // Run every 5 minutes

//   socket.on('request-analysis', () => {
//     // Allow clients to manually request a new analysis
//     performAnalysis();
//   });

//   socket.on('disconnect', () => {
//     console.log('Client disconnected from market analysis');
//     clearInterval(analysisInterval);
//   });
// });

// Create a namespace for Coinbase base actions
const baseActionNamespace = io.of('/baseAction');
const coinbaseAgentService = new CoinbaseTradeAgent();
baseActionNamespace.on('connection', async (socket) => {
    console.log('Client connected to Coinbase base actions');

    try {
        // Initialize the agent when a client connects
        await coinbaseAgentService.initialize();
        socket.emit('status', 'Agent initialized and ready');

        // Handle action requests
        socket.on('execute', async (action: string) => {
            try {
                console.log('Executing action:', action);
                const results = await coinbaseAgentService.runChatMode();
                
                socket.emit('action-results', results);
            } catch (error) {
                console.error('Error executing action:', error);
                socket.emit('error', {
                    message: error instanceof Error ? error.message : 'Failed to execute action',
                    timestamp: new Date().toISOString()
                });
            }
        });

        // Handle manual cleanup request
        socket.on('cleanup', async () => {
            try {
                await coinbaseAgentService.cleanup();
                socket.emit('status', 'Agent cleaned up successfully');
            } catch (error) {
                console.error('Error during cleanup:', error);
                socket.emit('error', {
                    message: error instanceof Error ? error.message : 'Failed to cleanup',
                    timestamp: new Date().toISOString()
                });
            }
        });

        socket.on('disconnect', async () => {
            console.log('Client disconnected from base actions');
            try {
                await coinbaseAgentService.cleanup();
            } catch (error) {
                console.error('Error during disconnect cleanup:', error);
            }
        });

    } catch (error) {
        console.error('Error initializing agent:', error);
        socket.emit('error', {
            message: 'Failed to initialize agent',
            timestamp: new Date().toISOString()
        });
    }
});

// --- Start the Server ---
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
