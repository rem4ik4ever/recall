import { z } from 'zod';
import { CoreBlock } from '../types';
import { MemoryManager } from '../memoryManager';
import { tool } from 'ai'

export async function createTools(memoryManager: MemoryManager) {
  return {
    coreMemoryAppend: tool({
      description: 'Append content to a specific core memory block',
      parameters: z.object({
        block: z.string().describe('The core block to append to'),
        content: z.string().describe('The content to append'),
      }),
      execute: async ({ block, content }: { block: CoreBlock; content: string }) => {
        try {
          const coreBlock = await memoryManager.getCoreMemory()
          if (!coreBlock) {
            return `No core memory found`;
          }
          const blockConfig = coreBlock[block];
          const newContent = `${blockConfig?.content || ''}\n${content}`;
          await memoryManager.updateCoreMemory(block, newContent);
          return `Updated ${block} block with: ${content}`;
        } catch (error) {
          if (error instanceof Error) {
            return `Failed to update ${block} block: ${error.message}`;
          }
          return `Failed to update ${block} block: Unknown error`;
        }
      },
    }),

    coreMemoryReplace: tool({
      description: 'Update the content of a specific core memory block',
      parameters: z.object({
        block: z.string().describe('The core block to update'),
        content: z.string().describe('The new content for the block'),
      }),
      execute: async ({ block, content }: { block: CoreBlock; content: string }) => {
        try {
          await memoryManager.updateCoreMemory(block, content);
          return {
            status: 'success',
            message: `Updated ${block} block with: ${content}`
          }
        } catch (error) {
          return {
            status: 'error',
            message: `Failed to update ${block} block: ${error instanceof Error ? error.message : 'Unknown error'}`
          }
        }
      },
    }),

    archivalMemorySearch: tool({
      description: 'Search archive memory for relevant information',
      parameters: z.object({
        query: z.string().describe('The query to search archive memory'),
      }),
      execute: async ({ query }: { query: string }) => {
        try {
          const memories = await memoryManager.searchArchiveMemory(query);
          return {
            status: 'success',
            data: memories
          }
        } catch (error) {
          return {
            status: 'error',
            error: error
          }
        }
      }
    }),

    archivalMemoryInsert: tool({
      description: 'Add new information to archive memory',
      parameters: z.object({
        name: z.string().describe('The name of the memory'),
        content: z.string().describe('The information to archive'),
      }),
      execute: async ({ name, content }: { name: string; content: string }) => {
        try {
          const result = await memoryManager.addToArchiveMemory({ name, content });
          return {
            status: 'success',
            data: result
          }
        } catch (error) {
          return {
            status: 'error',
            error: error
          }
        }
      },
    }),
  };
} 
