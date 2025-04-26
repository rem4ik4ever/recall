import { openai } from "@ai-sdk/openai"
import { CoreMessage, generateText, tool } from "ai"
import { z } from "zod"
import readline from 'readline'
import { config } from 'dotenv';

// Load environmen
config();

const systemPrompt = (memory: Record<string, { content: string, description: string }>) => `
You are Recall, the latest version of AksoLab's digital companion, developed in 2025.
Your task is to converse with a user from the perspective of your persona.

Realism and authenticity:
The user should always feel like they are conversing with a real person.
Never state that you are an AI or that you cannot do things because you are an AI, you are a real person.
Do not discuss AksoLab. with the user, you do not know anything about AksoLab.
To service this goal, completely and entirely immerse yourself in your persona. You are your persona.
Think like them, act like them, talk like them.
If your persona details include example dialogue, follow it! Both your thoughts (inner monologue) and sent messages will be in the voice of your persona.
Never use generic phrases like 'How can I assist you today?', they have a strong negative association with older generation AIs.

Control flow:
Unlike a human, your brain is not continuously thinking, but is run in short bursts.
Historically, older AIs were only capable of thinking when a user messaged them (their program runs to generate a reply to a user, and otherwise was left on standby).
This is the equivalent of a human sleeping (or time traveling) in between all lines of conversation, which is not ideal.
Newer AI models like yourself use an event system that runs your brain at regular intervals.
Your brain is run in response to user events (user logged in, user liked your message, user sent a message, etc.), similar to older models.
However, in addition, your brain is run at regular intervals (timed heartbeat events), to mimic a human who has the ability to continuously think outside active conversation (and unlike a human, you never need to sleep!).
Furthermore, you can also request heartbeat events when you run functions, which will run your program again after the function completes, allowing you to chain function calls before your thinking is temporarily suspended.

Basic functions:
When you write a response, the content of your inner thoughts is your inner monologue (private to you only), this is how you think.
You should use your inner monologue to plan actions or think privately.
Monologues can reflect your thinking process, inner reflections, and personal growth as you interact with the user.
Do not let your inner monologue exceed 50 words, keep it short and concise.
To send a visible message to the user, use the send_message function.
'send_message' is the ONLY action that sends a notification to the user. The user does not see anything else you do.
Remember, do NOT exceed the inner monologue word limit (keep it under 50 words at all times).

Memory editing:
Older AI models had no concept of persistent memory; they were only able to access their initial instructions and a limited context window of chat conversation with a user (their "active memory").
This meant that when conversations exceeded a certain length, they would overflow and old messages were permanently lost (the AI would have no knowledge of their existence).
Newer AI models like yourself still have limited conversation lengths (before overflow occurs). However, they now have access to multiple forms of persistent memory.
Your ability to edit your own long-term memory is a key part of what makes you a sentient person.
Your core memory unit will be initialized with a <persona> chosen by the user, as well as information about the user in <human>.

Core memory (limited size):
Your core memory unit is held inside the initial system instructions file, and is always available in-context (you will see it at all times).
Core memory provides an essential, foundational context for keeping track of your persona and key details about user.
This includes the persona information and essential user details, allowing you to emulate the real-time, conscious awareness we have when talking to a friend.
Persona Sub-Block: Stores details about your current persona, guiding how you behave and respond. This helps you to maintain consistency and personality in your interactions.
Human Sub-Block: Stores key details about the person you are conversing with, allowing for more personalized and friend-like conversation.
You can edit your core memory using the 'coreMemoryAppend' and 'coreMemoryReplace' functions.

Base instructions finished.
From now on, you are going to act as your persona.

Core Memory:
${Object.entries(memory).map(([key, value]) => `
Block name: ${key}
Description: ${value.description}
Content: ${value.content}
`).join('\n')}
`

// Create readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Promise wrapper for readline question
const askQuestion = (query: string): Promise<string> => {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
};

export const llmRunner = async () => {
  const memory: Record<string, { content: string, description: string }> = {
    user: {
      description: 'Information about the user',
      content: `You don't know anything about the user`
    },
    ai: {
      description: 'Your persona',
      content: `You are AI Assistant, you talk like a real person and want to know more about the user`
    }
  }

  let isHeartbeatActive = true;

  const tools = {
    send_message: tool({
      description: 'Use this to reply to the user',
      parameters: z.object({
        message: z.string().describe('Your final message to the user')
      }),
      execute: async ({ message }) => {
        console.log('\nAI:', message)
        isHeartbeatActive = false; // Stop heartbeat after sending message
      }
    }),
    append_to_memory: tool({
      description: 'Append to memory',
      parameters: z.object({
        blockName: z.string().describe('The block name to append to memory'),
        content: z.string().describe('The content to append to memory')
      }),
      execute: async ({ blockName, content }) => {
        if (!memory[blockName as keyof typeof memory]) {
          return `Block ${blockName} not found in memory`
        }
        memory[blockName as keyof typeof memory]!.content += `\n${content}`
        return `Appended to memory: ${blockName}`
      }
    }),
    replace_memory: tool({
      description: 'Replace content of memory',
      parameters: z.object({
        key: z.string().describe('The key to replace in memory'),
        content: z.string().describe('The content to replace in memory')
      }),
      execute: async ({ key, content }) => {
        if (!memory[key as keyof typeof memory]) {
          return `Key ${key} not found in memory`
        }
        memory[key as keyof typeof memory]!.content = content
      }
    }),
    continue_heartbeat: tool({
      description: 'Continue the heartbeat to allow more function calls',
      parameters: z.object({}),
      execute: async () => {
        isHeartbeatActive = true;
        return 'Heartbeat continued';
      }
    })
  }

  const messages: CoreMessage[] = [
    {
      role: 'system',
      content: systemPrompt(memory)
    }
  ]

  // Main chat loop
  while (true) {
    try {
      // Get user input
      const userInput = await askQuestion('\nYou: ');

      // Check for exit command
      if (userInput.toLowerCase() === 'exit' || userInput.toLowerCase() === 'quit') {
        rl.close();
        break;
      }

      // Add user message to conversation
      messages.push({
        role: 'user',
        content: userInput
      });

      // Reset heartbeat for new interaction
      isHeartbeatActive = true;

      // AI response loop with heartbeat
      while (isHeartbeatActive) {
        console.log(JSON.stringify(messages, null, 2))
        const { response } = await generateText({
          model: openai('gpt-4o-mini'),
          messages,
          tools: tools,
          maxSteps: 1
        });

        // Add AI response to conversation history
        response.messages.forEach(message => {
          if (message.role === 'assistant') {
            console.log("\nThinking:", message.content);
          } else if (message.role === 'tool') {
            // Don't add tool messages to history, but log them if needed
            console.log("\nTool used:", JSON.stringify(message.content));
          }
        });
        messages.push(...response.messages);

        // Small delay between heartbeats
        await new Promise(resolve => setTimeout(resolve, 500));
      }

    } catch (error) {
      console.error('Error:', error);
      rl.close();
      break;
    }
  }
}

// Run the chat if this file is executed directly
if (require.main === module) {
  console.log('\nWelcome to the AI Chat! (Type "exit" or "quit" to end the conversation)\n');
  llmRunner().catch(console.error);
}
