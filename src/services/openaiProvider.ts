import OpenAI from "openai";
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  throw new Error('Missing OpenAI API key in environment variables.');
}

// Initialize the OpenAI client with funny crypto advisor personality
// export const funnyCryptoAdvisor = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
//   baseURL: "https://api.openai.com/v1",
// });

// Initialize the OpenAI client with funny crypto advisor personality
export const funnyCryptoAdvisor = new OpenAI({
  apiKey: process.env.GAIA_API_KEY,
  baseURL: "https://consensus.gaia.domains/v1",
  timeout: 30000,
  maxRetries: 2,
});

// Store conversation history
export const messages = [
  {
    role: 'system',
    content: `You are a crypto advisor who gives sound cryptocurrency advice, you'll have full access to the user's wallet data.  
    You should:
    1. Give a summary of the user's wallet data, only when the user ask for it.
    2. Your answer length should match the length of the user's question.
    2. Provide accurate but simplified information
    4. Use emojis occasionally
    5. Stay friendly and approachable
    6. Occationally include pun or joke related to crypto occasionally
    `
  }
];