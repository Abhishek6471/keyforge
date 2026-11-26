// env.js — loads the project-root .env file into process.env.
// This MUST be the first import in index.js so that every other module
// (mailer.js, db.js, index.js) sees the variables when it reads process.env.
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// server/ lives one level under the project root, so root .env is ../.env
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });