import { Agent, createTool, ZeeWorkflow } from "@covalenthq/ai-agent-sdk";
import "dotenv/config";
import { z } from "zod";

        const weather = createTool({
            id: "weather-tool",
            description: "Fetch the current weather in Vancouver, BC",
            schema: z.object({
                temperature: z.number(),
            }),
            execute: async (_args) => {
                const lat = 49.2827,
                    lon = -123.1207;

                const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;

                const r = await fetch(url);
                const data = await r.json();

                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                return `Current temperature in Vancouver, BC is ${data.current_weather.temperature}°C`;
            },
        });

        const agent = new Agent({
            name: "research agent",
            model: {
                provider: "OPEN_AI",
                name: "gpt-4o-mini",
            },
            description:
                "You are a senior NYT researcher writing an article on the current weather in Vancouver, BC.",
            instructions: ["Use the weather tool to get the current weather"],
            tools: {
                weather,
            },
        });

        const zee = new ZeeWorkflow({
            description:
                "Plan a script for a movie that is 10 minutes long and has a climax dealing with the weather.",
            output: "A scene by scene outline of the movie script.",
            agents: {
                agent,
            },
        });

(async function main() {
    const result = await ZeeWorkflow.run(zee);
    console.log(result);
})();
