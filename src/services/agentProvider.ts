import { Agent, ZeeWorkflow } from "@covalenthq/ai-agent-sdk";
import { fetchCryptoNews } from './newsProvider';

// Create the gossiper agent that focuses on news interpretation
const agentGossiper = new Agent({
    name: "Crypto Gossiper",
    model: {
        provider: "OPEN_AI",
        name: "gpt-4o-mini",
    },
    description: "You are a crypto news interpreter who loves to discuss the latest trends and developments in the crypto world.",
    instructions: [
        "Analyze crypto news and identify key trends",
        "Focus on market sentiment and social impact",
        "Keep responses concise and engaging"
    ],
});

// Create the financial analyst agent that provides technical analysis
const agentFinancialAnalyst = new Agent({
    name: "Financial Analyst",
    model: {
        provider: "OPEN_AI",
        name: "gpt-4o-mini",
    },
    description: "You are a seasoned financial analyst who provides technical analysis of crypto market trends based on news.",
    instructions: [
        "Analyze market implications of crypto news",
        "Provide technical perspective on market trends",
        "Focus on potential market impacts"
    ],
});

export async function runMarketAnalysis() {
    try {
        // Fetch latest news first
        const news = await fetchCryptoNews();
        const newsContext = news
            .slice(0, 12)
            .map(n => n.title)
            .join(". ");

        // Create workflow with context
        const zee = new ZeeWorkflow({
            description: `Analyze these crypto news and provide market insights. News context: ${newsContext}`,
            output: "A comprehensive analysis of the market trends based on recent news.",
            agents: {
                agentGossiper,
                agentFinancialAnalyst,
            },
        });

        // Run the workflow
        const result = await ZeeWorkflow.run(zee);
        return result;
    } catch (error) {
        console.error('Error in market analysis:', error);
        throw error;
    }
} 