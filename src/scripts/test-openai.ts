import OpenAI from "openai";
import dotenv from 'dotenv';

dotenv.config();

async function testOpenAIConnection() {
    // Initialize OpenAI with test configuration
    const gaiaClient = new OpenAI({
        apiKey: process.env.GAIA_API_KEY,
        baseURL: "https://consensus.gaia.domains/v1",
        timeout: 30000,
        maxRetries: 2,
    });

    try {
        console.log('Testing OpenAI connection...');
        
        const completion = await gaiaClient.chat.completions.create({
            model:'Llama-3.2-3B-Instruct',
            temperature: 0.7,
            messages: [
                {
                    role: 'user',
                    content: 'Hello, this is a test message. Please respond with a short greeting.',
                }
            ],
            max_tokens: 50,
        });

        console.log('Response received:', completion.choices[0]?.message?.content);
        
    } catch (error: any) {
        console.error('Error testing OpenAI connection:');
        console.error('Status:', error?.response?.status);
        console.error('Message:', error?.message);
        console.error('Full error:', error);
    }
}

// Run the test
testOpenAIConnection()
    .then(() => console.log('Test complete'))
    .catch(error => console.error('Test failed:', error))
    .finally(() => process.exit()); 