import { createServer } from "../server/index";
import type { VercelRequest, VercelResponse } from "@vercel/node";

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
