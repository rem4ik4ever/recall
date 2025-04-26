"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.chatTest = void 0;
const index_1 = require("../packages/recall/index");
const readline_1 = __importDefault(require("readline"));
const dotenv_1 = require("dotenv");
const openai_1 = require("@ai-sdk/openai");
const ai_1 = require("ai");
//import { RedisArchiveProvider, setupRedisSchema } from "@aksolab/recall-redis-search-adapter";
const redis_1 = require("redis");
// Load environment variables
(0, dotenv_1.config)();
const redisSearchClient = (0, redis_1.createClient)({
    url: 'redis://localhost:6380',
});
const rl = readline_1.default.createInterface({
    input: process.stdin,
    output: process.stdout
});
const question = (query) => {
    return new Promise((resolve) => {
        rl.question(query, (answer) => {
            resolve(answer);
        });
    });
};
async function getAIResponse(session) {
    process.stdout.write("AI: ");
    let fullResponse = '';
    const chatHistory = await session.chatHistory();
    const { textStream, response } = (0, ai_1.streamText)({
        model: (0, openai_1.openai)('gpt-4o-mini'),
        messages: chatHistory,
        tools: {
            ...session.tools,
        },
        toolChoice: 'auto',
        maxSteps: 5,
        onStepFinish: (step) => {
            if (step.toolCalls.length > 0) {
                for (const toolCall of step.toolCalls) {
                    process.stdout.write('---\n');
                    process.stdout.write("Tool call: " + toolCall.toolName + "\n");
                    process.stdout.write("Tool args: " + JSON.stringify(toolCall.args, null, 2) + "\n");
                }
                for (const toolResult of step.toolResults) {
                    process.stdout.write("Tool result: " + JSON.stringify(toolResult, null, 2) + "\n");
                    process.stdout.write('---\n');
                }
                //console.log({
                //  toolCalls: step.toolCalls,
                //  toolResults: step.toolResults,
                //  text: step.text,
                //  usage: step.usage,
                //})
            }
        }
    });
    for await (const chunk of textStream) {
        process.stdout.write(chunk);
        fullResponse += chunk;
    }
    process.stdout.write('\n');
    const { messages: responseMessages } = await response;
    //console.log({
    //  messages: JSON.stringify(responseMessages, null, 2)
    //})
    const formatContent = (content) => {
        if (typeof content === 'string') {
            return content;
        }
        return content.map((part) => {
            if (part.type === 'text') {
                return part.text;
            }
            else if (part.type === 'tool-call') {
                return part.toolName;
            }
            else if (part.type === 'tool-result') {
                return part.result;
            }
            return '';
        }).join('');
    };
    const formattedResponseMessages = responseMessages.map((message) => ({
        role: message.role,
        content: formatContent(message.content)
    }));
    const { messages } = await response;
    return messages;
}
const chatTest = async () => {
    console.log("Starting chat test...");
    if (!process.env.OPENAI_API_KEY) {
        console.error("Error: OPENAI_API_KEY environment variable is not set");
        process.exit(1);
    }
    try {
        // Connect to Redis before creating providers
        await redisSearchClient.connect();
        console.log("Connected to Redis successfully");
        const collectionName = 'recall-test-1';
        const storage = new index_1.RedisProvider({
            client: redisSearchClient,
            prefix: collectionName
        });
        const archiveProvider = new RedisArchiveProvider({
            client: redisSearchClient,
            indexName: 'idx:archive',
            collectionName: `${collectionName}:`,
        });
        const recall = new index_1.Recall({
            storageProvider: storage,
            archiveProvider: archiveProvider,
            openaiApiKey: process.env.OPENAI_API_KEY,
            memoryKey: 'user-rem-2',
            threadId: 'thread-15',
            coreBlocks: [
                {
                    key: 'user',
                    description: 'Useful information about the user',
                    defaultContent: 'not available'
                },
                {
                    key: 'ai',
                    description: 'You (AI Assistant) personality, behavior, and other information about you',
                    defaultContent: 'You are a helpful assistant that can answer questions and help with tasks.'
                }
            ]
        });
        console.log("\nChat session started. Type 'exit' to end the session.");
        while (true) {
            const userInput = await question("\nYou: ");
            if (userInput.toLowerCase() === 'export') {
                const memoryState = await storage.export('user-rem-2', 'thread-15');
                console.log(JSON.stringify(memoryState, null, 2));
                continue;
            }
            if (userInput.toLowerCase() === 'exit') {
                break;
            }
            // Add user message
            await recall.addUserMessage({ role: 'user', content: userInput });
            // Get AI response using the full chat history and memory tools
            const responseMessages = await getAIResponse(recall);
            // Add AI response to chat history
            await recall.addAIMessages(responseMessages);
        }
        rl.close();
        await redisSearchClient.disconnect();
    }
    catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};
exports.chatTest = chatTest;
// Run the chat test if this file is executed directly
if (require.main === module) {
    (0, exports.chatTest)().catch(console.error);
}
