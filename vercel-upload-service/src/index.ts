import express from "express";
import cors from "cors";
import simpleGit from "simple-git";
import fs from "fs";
import { generate, getAllFiles } from "./utils";
import path from "path";
import { uploadFile } from "./aws";

import { createClient } from "redis";
const publisher = createClient();
publisher.connect();

// Redis client for reading deployment status
const subscriber = createClient();
subscriber.connect();

// Ensure output directory exists
fs.mkdirSync("output", { recursive: true });

const app = express();
app.use(cors());
app.use(express.json());

// Debug root endpoint to verify server is up
app.get("/", (req, res) => {
  res.send("Server is up and running");
});

// POSTMAN
app.post("/deploy", async (req, res) => {
  // log request body for debugging
  console.log("Received /deploy request with body:", req.body);
  try {
    const repoUrl = req.body.repoUrl;
    const id = generate();
    fs.mkdirSync(`output/${id}`, { recursive: true });
    await simpleGit().clone(repoUrl, path.join(__dirname, `../output/${id}`));
    const files = getAllFiles(path.join(__dirname, `../output/${id}`));
    res.status(200).json({
      id: id,
      message: `Deployment initiated for ${repoUrl} with ID: ${id}`,
    });

    files.forEach(async (file) => {
      await uploadFile(file.slice(__dirname.length + 1), file);
    });

    // wait 5 seconds before queuing for build
    await new Promise((resolve) => setTimeout(resolve, 5000));
    // mark status as uploaded before queuing for build
    await publisher.hSet("status", id, "uploaded");
    // Publish the deployment ID to Redis
    await publisher.lPush("build-queue", id);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Deployment failed" });
  }
});

// Status endpoint: return deployment status for a given ID
app.get("/status", async (req, res) => {
  const id = req.query.id as string;
  if (!id) {
    res.status(400).json({ error: "Missing 'id' query parameter" });
    return;
  }
  const status = await subscriber.hGet("status", id);
  if (status === null) {
    res.status(404).json({ error: `No status found for ID: ${id}` });
    return;
  }
  res.json({ status });
  return;
});

// Start server
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
