import OpenAI from "openai";
import dotenv from 'dotenv';
import readline from 'readline';
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

dotenv.config();

class GaiaChat {
    private client: OpenAI;
    private rl: readline.Interface;
    private conversationHistory: Array<{ role: string; content: string }> = [];

    constructor() {
        this.client = new OpenAI({
            apiKey: process.env.GAIA_API_KEY,
            baseURL: "https://consensus.gaia.domains/v1",
            timeout: 30000,
            maxRetries: 2,
        });

        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        // Initialize with system message
        this.conversationHistory.push({
            role: 'system',
            content: 'You are a helpful AI assistant. Be concise and clear in your responses.'
        });
    }

    private async getCompletion(message: string) {
        this.conversationHistory.push({ role: 'user', content: message });

        try {
            const completion = await this.client.chat.completions.create({
                model: 'Llama-3.2-3B-Instruct',
                messages: this.conversationHistory as ChatCompletionMessageParam[],
                temperature: 0.7,
                max_tokens: 150,
            });

            const response = completion.choices[0]?.message?.content;
            if (response) {
                this.conversationHistory.push({ role: 'assistant', content: response });
                return response;
            }
        } catch (error: any) {
            console.error('\nError:', error.message);
            return 'Sorry, I encountered an error processing your request.';
        }
    }

    private async prompt(question: string): Promise<string> {
        return new Promise((resolve) => {
            this.rl.question(question, (answer) => {
                resolve(answer);
            });
        });
    }

    public async start() {
        console.log('\nGaia Chat Interface');
        console.log('Type "exit" to quit, "clear" to reset conversation, "history" to see conversation history');
        console.log('----------------------------------------\n');

        while (true) {
            const input = await this.prompt('\nYou: ');

            if (input.toLowerCase() === 'exit') {
                break;
            }

            if (input.toLowerCase() === 'clear') {
                this.conversationHistory = [this.conversationHistory[0]]; // Keep system message
                console.log('\nConversation cleared.');
                continue;
            }

            if (input.toLowerCase() === 'history') {
                console.log('\nConversation History:');
                this.conversationHistory.forEach((msg, i) => {
                    if (i === 0) return; // Skip system message
                    console.log(`${msg.role}: ${msg.content}\n`);
                });
                continue;
            }

            const response = await this.getCompletion(input);
            console.log('\nAssistant:', response);
        }

        this.rl.close();
        console.log('\nGoodbye! 👋');
    }
}

// Start the chat interface
const chat = new GaiaChat();
chat.start().catch(console.error); 