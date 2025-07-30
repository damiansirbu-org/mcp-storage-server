#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { StorageDatabase } from './database.js';
import { z } from 'zod';

const db = new StorageDatabase();

const server = new Server(
  {
    name: 'storage-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool schemas
const StoreItemSchema = z.object({
  id: z.string().describe('Unique identifier for the item'),
  title: z.string().describe('Title or name of the item'),
  content: z.string().describe('The main content to store'),
  tags: z.array(z.string()).optional().describe('Optional tags for categorization'),
});

const RetrieveItemSchema = z.object({
  id: z.string().describe('Unique identifier of the item to retrieve'),
});

const SearchItemsSchema = z.object({
  query: z.string().describe('Search query (supports full-text search)'),
  limit: z.number().optional().default(10).describe('Maximum number of results to return'),
});

const ListItemsSchema = z.object({
  limit: z.number().optional().default(50).describe('Maximum number of items to return'),
  offset: z.number().optional().default(0).describe('Number of items to skip'),
});

const DeleteItemSchema = z.object({
  id: z.string().describe('Unique identifier of the item to delete'),
});

// Define tools
const tools: Tool[] = [
  {
    name: 'store_item',
    description: 'Store an item with full-text search capability',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique identifier for the item' },
        title: { type: 'string', description: 'Title or name of the item' },
        content: { type: 'string', description: 'The main content to store' },
        tags: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Optional tags for categorization'
        },
      },
      required: ['id', 'title', 'content'],
    },
  },
  {
    name: 'retrieve_item',
    description: 'Retrieve a specific item by its ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique identifier of the item to retrieve' },
      },
      required: ['id'],
    },
  },
  {
    name: 'search_items',
    description: 'Search items using full-text search across title, content, and tags',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (supports full-text search)' },
        limit: { type: 'number', description: 'Maximum number of results to return', default: 10 },
      },
      required: ['query'],
    },
  },
  {
    name: 'list_items',
    description: 'List all items with pagination',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Maximum number of items to return', default: 50 },
        offset: { type: 'number', description: 'Number of items to skip', default: 0 },
      },
    },
  },
  {
    name: 'delete_item',
    description: 'Delete an item by its ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Unique identifier of the item to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_tags',
    description: 'Get all unique tags used in stored items',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'store_item': {
        const { id, title, content, tags } = StoreItemSchema.parse(args);
        const item = db.store(id, title, content, tags || []);
        return {
          content: [
            {
              type: 'text',
              text: `Successfully stored item "${title}" with ID: ${id}`,
            },
          ],
        };
      }

      case 'retrieve_item': {
        const { id } = RetrieveItemSchema.parse(args);
        const item = db.retrieve(id);
        
        if (!item) {
          return {
            content: [
              {
                type: 'text',
                text: `Item with ID "${id}" not found`,
              },
            ],
          };
        }

        return {
          content: [
            {
              type: 'text',
              text: `**${item.title}**\n\n${item.content}\n\n*Tags: ${item.tags || 'none'}*\n*Created: ${item.created_at}*\n*Updated: ${item.updated_at}*`,
            },
          ],
        };
      }

      case 'search_items': {
        const { query, limit } = SearchItemsSchema.parse(args);
        const items = db.search(query, limit);
        
        if (items.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `No items found matching query: "${query}"`,
              },
            ],
          };
        }

        const results = items.map(item => 
          `**${item.title}** (ID: ${item.id})\n${item.content.substring(0, 200)}${item.content.length > 200 ? '...' : ''}\n*Tags: ${item.tags || 'none'}*`
        ).join('\n\n---\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `Found ${items.length} item(s) matching "${query}":\n\n${results}`,
            },
          ],
        };
      }

      case 'list_items': {
        const { limit, offset } = ListItemsSchema.parse(args);
        const items = db.list(limit, offset);
        
        if (items.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No items found',
              },
            ],
          };
        }

        const results = items.map(item => 
          `**${item.title}** (ID: ${item.id})\n${item.content.substring(0, 150)}${item.content.length > 150 ? '...' : ''}\n*Updated: ${item.updated_at}*`
        ).join('\n\n---\n\n');

        return {
          content: [
            {
              type: 'text',
              text: `Listing ${items.length} item(s):\n\n${results}`,
            },
          ],
        };
      }

      case 'delete_item': {
        const { id } = DeleteItemSchema.parse(args);
        const deleted = db.delete(id);
        
        return {
          content: [
            {
              type: 'text',
              text: deleted 
                ? `Successfully deleted item with ID: ${id}` 
                : `Item with ID "${id}" not found`,
            },
          ],
        };
      }

      case 'get_tags': {
        const tags = db.getTags();
        
        return {
          content: [
            {
              type: 'text',
              text: tags.length > 0 
                ? `Available tags: ${tags.join(', ')}` 
                : 'No tags found',
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    };
  }
});

// Handle cleanup
process.on('SIGINT', () => {
  db.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  db.close();
  process.exit(0);
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Storage MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});