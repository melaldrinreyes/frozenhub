import type { IncomingMessage, ServerResponse } from "http";

type VercelRequest = IncomingMessage & {
  query?: Record<string, string | string[]>;
  body?: unknown;
  method?: string;
  url?: string;
};

type VercelResponse = ServerResponse;

// Vercel executes this file in Node.js directly. Import the prebuilt server bundle
// to avoid runtime TypeScript module resolution issues.
const { createServer } = await import("../dist/serverless/index.mjs");

const app = createServer();

// Export handler for Vercel serverless function
export default async (req: VercelRequest, res: VercelResponse) => {
  return new Promise((resolve, reject) => {
    app(req as any, res as any, (err: any) => {
      if (err) {
        reject(err);
      } else {
        resolve(undefined);
      }
    });
  });
};
