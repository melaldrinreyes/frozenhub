import serverless from "serverless-http";
import { createServer } from "../../server";

// Wrap the express app
export const handler = serverless(createServer());
