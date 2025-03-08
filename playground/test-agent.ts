import { Recall, RedisProvider } from "../index";
import { ChatSession } from "../src/types";
import readline from 'readline';
import { config } from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { CoreAssistantMessage, Tool, CoreToolMessage, streamText, tool } from 'ai';
import { RedisArchiveProvider } from "../src/archiveProviders/RedisArchiveProvider/RedisArchiveProvider";
import { createClient, RedisClientType } from "redis";
import { CoreMessage } from 'ai'

// Load environment variables
config();

const redisSearchClient = createClient({
  url: 'redis://localhost:6380',
});


const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      resolve(answer);
    });
  });
};

async function getAIResponse(
  session: ChatSession
): Promise<CoreMessage[]> {
  process.stdout.write("AI: ");
  let fullResponse = '';

  const chatHistory = await session.chatHistory();

  const { textStream, response } = streamText({
    model: openai('gpt-4o-mini'),
    messages: chatHistory as any,
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

  const formatContent = (content: CoreAssistantMessage['content'] | CoreToolMessage['content']) => {
    if (typeof content === 'string') {
      return content;
    }
    return content.map((part) => {
      if (part.type === 'text') {
        return part.text;
      } else if (part.type === 'tool-call') {
        return part.toolName;
      } else if (part.type === 'tool-result') {
        return part.result;
      }
      return '';
    }).join('');
  }

  const formattedResponseMessages = responseMessages.map((message) => ({
    role: message.role,
    content: formatContent(message.content)
  }));
  const { messages } = await response;

  return messages as CoreMessage[];
}

export const chatTest = async () => {
  console.log("Starting chat test...");

  if (!process.env.OPENAI_API_KEY) {
    console.error("Error: OPENAI_API_KEY environment variable is not set");
    process.exit(1);
  }

  const collectionName = 'recall-test-1'
  const storage = new RedisProvider({
    client: redisSearchClient as RedisClientType,
    prefix: collectionName
  });

  const archiveProvider = new RedisArchiveProvider({
    client: redisSearchClient as RedisClientType,
    indexName: 'idx:archive',
    collectionName: collectionName,
  })

  await redisSearchClient.connect();
  const recall = new Recall({
    storageProvider: storage,
    archiveProvider: archiveProvider,
    openaiApiKey: process.env.OPENAI_API_KEY,
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

  const threadId = 'thread-15';
  const memoryKey = 'user-rem-2';
  const session = await recall.createChatSession(memoryKey, threadId);
  const {
    addUserMessage,
    addAIMessages,
  } = session;

  console.log("\nChat session started. Type 'exit' to end the session.");

  while (true) {
    const userInput = await question("\nYou: ");

    if (userInput.toLowerCase() === 'export') {
      const memoryState = await storage.export(memoryKey, threadId);
      console.log(JSON.stringify(memoryState, null, 2));
      continue;
    }

    if (userInput.toLowerCase() === 'exit') {
      break;
    }

    // Add user message
    await addUserMessage({ role: 'user', content: userInput });

    // Get AI response using the full chat history and memory tools
    const responseMessages = await getAIResponse(session);

    // Add AI response to chat history
    //await addAIMessage({ role: 'assistant', content: aiResponse });
    await addAIMessages(responseMessages);

    // Show updated chat history
    //console.log("\nChat history:", chatHistory);
  }

  rl.close();
};

// Run the chat test if this file is executed directly
if (require.main === module) {
  chatTest().catch(console.error);
}
