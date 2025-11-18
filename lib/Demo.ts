import { MongoClient } from "mongodb";

// Ensure the MONGODBDEMO_URI environment variable is defined
if (!process.env.MONGODBDEMO_URI) {
  throw new Error("Please define the MONGODBDEMO_URI environment variable");
}

const uri = process.env.MONGODBDEMO_URI;
let client: MongoClient;
let clientPromise: Promise<MongoClient>;

// Extend the NodeJS.Global interface to include _mongoClientDemo
declare global {
  // eslint-disable-next-line no-var
  var _mongoClientDemo: MongoClient | undefined;
}

if (process.env.NODE_ENV === "development") {
  // Use a global variable to maintain a cached connection across hot reloads in development
  if (!global._mongoClientDemo) {
    client = new MongoClient(uri);
    global._mongoClientDemo = client;
  } else {
    client = global._mongoClientDemo;
  }
  clientPromise = client.connect();
} else {
  // In production, create a new client for each connection
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

// Export the promise to be used for database connections
export default clientPromise;

export async function connectToDatabaseDemo() {
  const client = await clientPromise;
  return client.db("Asset");
}
