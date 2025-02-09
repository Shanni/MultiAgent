import {
    AgentKit,
    ViemWalletProvider,
    wethActionProvider,
    walletActionProvider,
    erc20ActionProvider,
    pythActionProvider,
  } from "@coinbase/agentkit";
  import { getLangChainTools } from "@coinbase/agentkit-langchain";
  import { HumanMessage } from "@langchain/core/messages";
  import { MemorySaver } from "@langchain/langgraph";
  import { createReactAgent } from "@langchain/langgraph/prebuilt";
  import { ChatOpenAI } from "@langchain/openai";
  import * as fs from "fs";

  // Viem-related imports for wallet management
  import { createWalletClient, http } from "viem";
  import { privateKeyToAccount } from "viem/accounts";
  import { baseSepolia, arbitrumSepolia, base, flowTestnet } from "viem/chains";

  import * as readline from "readline";
  
  // Configure a file to persist the agent's CDP MPC Wallet Data
  const WALLET_DATA_FILE = "wallet_data_generic.txt";
  
  /**
   * Validates that required environment variables are set
   *
   * @throws {Error} - If required environment variables are missing
   * @returns {void}
   */
  function validateEnvironment(): void {
      const missingVars: string[] = [];
  
      // Check required variables
      const requiredVars = ["OPENAI_API_KEY", "WALLET_PRIVATE_KEY"];
      requiredVars.forEach(varName => {
          if (!process.env[varName]) {
              missingVars.push(varName);
          }
      });
  
      // Exit if any required variables are missing
      if (missingVars.length > 0) {
          console.error("Error: Required environment variables are not set");
          missingVars.forEach(varName => {
              console.error(`${varName}=your_${varName.toLowerCase()}_here`);
          });
          process.exit(1);
      }
  }
  
  export class CoinbaseTradeAgent {
      private agentKit: AgentKit | any;
      private walletProvider: ViemWalletProvider | undefined;
      private agent: any; // Type will be ReactAgent
      private agentConfig: any;
      private memory: MemorySaver;
      
      constructor() {
          // Validate environment before initialization
          validateEnvironment();
          this.memory = new MemorySaver();
      }
  
      /**
       * Initialize the agent with CDP Agentkit
       * @returns Promise<void>
       */
      private async initializeAgent() {
          try {
              // Initialize LLM
              const llm = new ChatOpenAI({
                  model: "gpt-4o-mini",
              });
  
              let walletDataStr: string | null = null;
  
              // Read existing wallet data if available
              if (fs.existsSync(WALLET_DATA_FILE)) {
                  try {
                      walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
                  } catch (error) {
                      console.error("Error reading wallet data:", error);
                  }
              }

              const account = privateKeyToAccount(
                process.env.WALLET_PRIVATE_KEY as `0x${string}`,
              );
  
              const client = createWalletClient({
                account,
                chain: baseSepolia,
                transport: http(),
              });
  
              this.walletProvider = new ViemWalletProvider(client);
  
              // Initialize AgentKit
              this.agentKit = await AgentKit.from({
                  walletProvider: this.walletProvider,
                  actionProviders: [
                      wethActionProvider(),
                      pythActionProvider(),
                      walletActionProvider(),
                      erc20ActionProvider(),
                  ],
              });
  
              const tools = await getLangChainTools(this.agentKit);
  
              // Store buffered conversation history in memory
              this.agentConfig = { configurable: { thread_id: "CDP AgentKit Chatbot Example!" } };
  
              // Create React Agent using the LLM and CDP AgentKit tools
              this.agent = createReactAgent({
                  llm,
                  tools,
                  checkpointSaver: this.memory,
                  messageModifier: `
                      You are a helpful agent that can interact onchain using the Coinbase Developer Platform AgentKit. You are 
                      empowered to interact onchain using your tools. If you ever need funds, you can request them from the 
                      faucet if you are on network ID 'base-sepolia'. If not, you can provide your wallet details and request 
                      funds from the user. Before executing your first action, get the wallet details to see what network 
                      you're on. If there is a 5XX (internal) HTTP error code, ask the user to try again later. If someone 
                      asks you to do something you can't do with your currently available tools, you must say so, and 
                      encourage them to implement it themselves using the Agentkit, recommend they go to 
                      docs.cdp.coinbase.com for more information. Be concise and helpful with your responses. Refrain from 
                      restating your tools' descriptions unless it is explicitly requested.
                  `,
              });
  
          } catch (error) {
              console.error("Failed to initialize agent:", error);
              throw error;
          }
      }
  
      /**
       * Run the agent autonomously with specified intervals
       */
      async runAutonomousMode(interval = 10) {
          console.log("Starting autonomous mode...");
  
          while (true) {
              try {
                  const thought =
                      "Be creative and do something interesting on the blockchain. " +
                      "Choose an action or set of actions and execute it that highlights your abilities.";
  
                  const stream = await this.agent.stream(
                      { messages: [new HumanMessage(thought)] },
                      this.agentConfig
                  );
  
                  for await (const chunk of stream) {
                      if ("agent" in chunk) {
                          console.log(chunk.agent.messages[0].content);
                      } else if ("tools" in chunk) {
                          console.log(chunk.tools.messages[0].content);
                      }
                      console.log("-------------------");
                  }
  
                  await new Promise(resolve => setTimeout(resolve, interval * 1000));
              } catch (error) {
                  console.error("Error in autonomous mode:", error);
                  throw error;
              }
          }
      }
  
      /**
       * Run the agent interactively based on user input
       */
      async runChatMode() {
          console.log("Starting chat mode... Type 'exit' to end.");
  
          const rl = readline.createInterface({
              input: process.stdin,
              output: process.stdout,
          });
  
          const question = (prompt: string): Promise<string> =>
              new Promise(resolve => rl.question(prompt, resolve));
  
          try {
              while (true) {
                  const userInput = await question("\nPrompt: ");
  
                  if (userInput.toLowerCase() === "exit") {
                      break;
                  }
  
                  const stream = await this.agent.stream(
                      { messages: [new HumanMessage(userInput)] },
                      this.agentConfig
                  );
  
                  for await (const chunk of stream) {
                      if ("agent" in chunk) {
                          console.log(chunk.agent.messages[0].content);
                      } else if ("tools" in chunk) {
                          console.log(chunk.tools.messages[0].content);
                      }
                      console.log("-------------------");
                  }
              }
          } finally {
              rl.close();
          }
      }
  
      async initialize() {
          try {
              await this.initializeAgent();
              console.log("Coinbase Agent initialized and connected to network");
              return this;
          } catch (error) {
              console.error("Failed to initialize CoinbaseTradeAgent:", error);
              throw error;
          }
      }
  
      async getBlockDetails(blockNumber: number) {
          return await this.agentKit?.provider.getBlock(blockNumber);
      }
  
      /**
       * Get the React agent instance
       */
      getAgent() {
          return this.agent;
      }
  
      /**
       * Get the agent configuration
       */
      getAgentConfig() {
          return this.agentConfig;
      }
  } 