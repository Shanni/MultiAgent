import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import { funnyCryptoAdvisor, messages } from './services/openaiProvider';
import { ChatCompletionMessageParam } from 'openai/resources/chat/completions';
import { fetchCryptoNews } from './services/newsProvider';
import { runMarketAnalysis } from './services/agentProvider';
import { CoinbaseTradeAgent } from './services/coinbaseAgentkitProvider';
import { HumanMessage } from '@langchain/core/messages';
import { OnchainTradeAgent } from './services/genericAgentkitProvider';
// Load environment variables from a .env file (if you use one)
dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true,
  pingTimeout: 60000,
  pingInterval: 25000
});

// Add error handling for socket connections
io.on('connect_error', (error) => {
  console.error('Socket connection error:', error);
});

io.on('connect_timeout', (timeout) => {
  console.error('Socket connection timeout:', timeout);
});

// --- OpenAI Setup ---
if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OpenAI API key in environment variables.');
}

// Add interface for context
interface ChatContext {
  walletAddress?: string;
  selectedChain?: string;
  walletData?: any;
  lastTransaction?: any;
  balance?: string;
  assets?: any[];
}

// Create a namespace for chat with context management
const chatNamespace = io.of('/chat');

// Store context for each connection
const contextMap = new Map<string, ChatContext>();

chatNamespace.on('connection', (socket) => {
  console.log('Client connected');

  // Initialize empty context for this connection
  contextMap.set(socket.id, {});

  // Send a welcome message to the connected client
  socket.emit('output', 'What can I do for you today?');

  // Listen for context updates
  socket.on('context-update', (context: Partial<ChatContext>) => {
    const currentContext = contextMap.get(socket.id) || {};
    contextMap.set(socket.id, { ...currentContext, ...context });

    // Add context to system message
    const contextInfo = `
      Current wallet: ${context.walletAddress || 'Not connected'}
      Chain: ${context.selectedChain || 'Not selected'}
      Balance: ${context.balance || 'Unknown'}
    `;

    // Update system message with context
    messages[0] = {
      role: 'system',
      content: `You are a crypto advisor who gives sound cryptocurrency advice, keep your answers short and concise. 
      Current context: ${contextInfo}
      You should:
      1. Your answer length should match the length of the user's question
      2. Provide accurate but simplified information
      3. Use emojis occasionally
      4. Stay friendly and approachable
      5. Occasionally include pun or joke related to crypto
      6. Reference the wallet and chain information when relevant
      7. Provide specific advice based on the current balance when appropriate`
    };
  });

  // Listen for input from the client
  socket.on('input', async (userMessage: string) => {
    console.log('Received input:', userMessage);
    const context = contextMap.get(socket.id);

    const contextData = JSON.parse(userMessage);
    const { walletAddress, chainName, totalValue, assets } = contextData?.context || {};
    if ((!context && contextData?.context) || (context?.selectedChain != chainName)) {
      // Update context in map
      contextMap.set(socket.id, {
        walletAddress,
        selectedChain: chainName,
        balance: totalValue,
        assets
      });

      // const walletSummary = {
      //   role: 'assistant',
      //   content: `I see you're using a wallet on ${chainName} with a total value of ${totalValue}. ` +
      //     `Your portfolio contains ${assets.length} different assets. ` +
      //     `Let me know if you'd like specific advice about your holdings! 💼✨`
      // };

      // messages.push(walletSummary);
      // socket.emit('output', walletSummary.content);

      // Add the user message to the messages array
      messages.push({
        role: 'user',
        content: `Can you analyze my wallet? Here are the details:
      Wallet Address: ${walletAddress}
      Chain: ${chainName} 
      Total Value: ${totalValue}
      Assets: ${assets.map((asset: any) => `
        - ${asset.name} (${asset.symbol})
          Balance: ${asset.balance}
          Current Value: $${asset.value}
          24h Change: ${((asset.price - asset.price_24) / asset.price_24 * 100).toFixed(2)}%
      `).join('')}
      this is background knowledge, please keep it in mind.`
      });
      const completion = await funnyCryptoAdvisor.chat.completions.create({
        model: 'gpt-4o',
        messages: messages as ChatCompletionMessageParam[],
        max_tokens: 200,
        temperature: 0.7,
      });

      messages.push({ role: 'assistant', content: String(completion.choices[0].message?.content) });
      socket.emit('output', `Initial analysis 🔍: ${String(completion.choices[0].message?.content)}`);
    } else {
      // messages.push({ role: 'user', content: contextData.message });
      console.log('=========================messages========================\n', messages);
      try {
        // Call OpenAI's Chat Completion API
        const completion = await funnyCryptoAdvisor.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: messages as ChatCompletionMessageParam[],
          max_tokens: 200,
          temperature: 0.7,
        });

        // Extract the reply from OpenAI's response
        const aiReply = completion.choices[0].message?.content;
        messages.push({ role: 'user', content: contextData.message });
        messages.push({ role: 'assistant', content: String(aiReply) });

        console.log('AI reply:', aiReply);

        // Send the reply back to the client
        socket.emit('output', aiReply);
      } catch (error) {
        console.error('Error calling OpenAI API:', error);
        socket.emit('output', 'Sorry, there was an error processing your request.');
      }
    }
  });

  // Handle client disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected');
    contextMap.delete(socket.id);
  });
});

// Add this after your app initialization
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Add WebSocket specific health check
app.get('/socket-health', (_req, res) => {
  const connectedClients = io.engine.clientsCount;
  res.status(200).json({ 
    status: 'ok', 
    connections: connectedClients,
    timestamp: new Date().toISOString() 
  });
});

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

// Create a namespace for market analysis
const analysisNamespace = io.of('/news-based-analysis');

analysisNamespace.on('connection', (socket) => {
  console.log('Client connected to market analysis');

  let analysisInterval: NodeJS.Timeout;

  // Function to run and emit analysis
  async function performAnalysis() {
    try {
      const analysis = await runMarketAnalysis();
      socket.emit('news-analysis', {
        timestamp: new Date().toISOString(),
        analysis
      });
    } catch (error) {
      socket.emit('error', {
        message: error instanceof Error ? error.message : 'Analysis failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  // Initial analysis
  // performAnalysis();

  // Set up periodic analysis updates
  // analysisInterval = setInterval(performAnalysis, 5 * 60 * 1000); // Run every 5 minutes

  socket.on('request-analysis', () => {
    // Allow clients to manually request a new analysis
    performAnalysis();
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected from market analysis');
    // clearInterval(analysisInterval);
  });
});

// Create a namespace for Coinbase base actions
const baseActionNamespace = io.of('/baseAction');
// const coinbaseAgentService = new CoinbaseTradeAgent();
const onchainTradeAgent = new OnchainTradeAgent();
baseActionNamespace.on('connection', async (socket) => {
  try {
    // Initialize the agent when a client connects
    await onchainTradeAgent.initialize();
    socket.emit('status', 'Hey there! 😊 I\'m your friendly Onchain Agent, all set and ready to help! 🚀💰 What can I do for you today?');

    const onchainAgent = onchainTradeAgent.getAgent();
    // Handle action requests
    socket.on('input', async (userMessage: string) => {
      try {
        console.log('Onchain Agent input:', userMessage);
        const results = await onchainAgent.stream(
          { messages: [new HumanMessage(userMessage)] },
          onchainTradeAgent.getAgentConfig()
        );

        for await (const chunk of results) {
          const messageContent = chunk.agent?.messages[0]?.content || chunk.tools?.messages[0]?.content;
          if (messageContent) {
            socket.emit('output', messageContent);
          }
        }

      } catch (error) {
        console.error('Error executing action:', error);
        // socket.emit('error', {
        //   message: error instanceof Error ? error.message : 'Failed to execute action',
        //   timestamp: new Date().toISOString()
        // });
      }
    });

    // Handle manual cleanup request
    socket.on('disconnect', async () => {
      try {
        // socket.emit('status', 'Agent cleaned up successfully');
      } catch (error) {
        console.error('Error during cleanup:', error);
        // socket.emit('error', {
        //   message: error instanceof Error ? error.message : 'Failed to cleanup',
        //   timestamp: new Date().toISOString()
        // });
      }
    });

  } catch (error) {
    console.error('Error initializing agent:', error);
    // socket.emit('error', {
    //   message: 'Failed to initialize agent',
    //   timestamp: new Date().toISOString()
    // });
  }
});

// // Global error handling for WebSocket connections
// io.engine.on("connection_error", (err) => {
//   console.log('Connection error:', err);
// });

// // Add monitoring for namespace connections
// ['chat', 'news', 'news-based-analysis', 'baseAction'].forEach(namespace => {
//   io.of(`/${namespace}`).on('connection', (socket) => {
//     console.log(`Client connected to ${namespace}. ID: ${socket.id}`);
    
//     socket.on('error', (error) => {
//       console.error(`Error in ${namespace} namespace:`, error);
//     });

//     socket.on('disconnect', (reason) => {
//       console.log(`Client disconnected from ${namespace}. Reason: ${reason}`);
//     });
//   });
// });

// --- Start the Server ---
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
