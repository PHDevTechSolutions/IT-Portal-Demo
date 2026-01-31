import { MongoClient, ObjectId, Db } from "mongodb";
import bcrypt from "bcrypt";

// Ensure the MONGODB_URI environment variable is defined
if (!process.env.MONGODB_URI) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

const uri = process.env.MONGODB_URI;

// 🔹 Reuse Mongo client across hot reloads in dev
let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // extend global type para iwas TS errors
  // eslint-disable-next-line no-var
  var _mongoClient: MongoClient | undefined;
}

if (process.env.NODE_ENV === "development") {
  if (!global._mongoClient) {
    global._mongoClient = new MongoClient(uri);
  }
  client = global._mongoClient;
  clientPromise = client.connect();
} else {
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

// 🔹 Exported function for database connection
export async function connectToDatabase(): Promise<Db> {
  const client = await clientPromise;
  return client.db("ecoshift"); // Main DB
}


// 🔹 Register a new user
export async function registerUser({
  userName,
  Email,
  Password,
}: {
  userName: string;
  Email: string;
  Password: string;
}) {
  const db = await connectToDatabase();
  const usersCollection = db.collection("users");

  // Check if email already exists
  const existingUser = await usersCollection.findOne({ Email });
  if (existingUser) {
    return { success: false, message: "Email already in use" };
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(Password, 10);

  // Insert new user
  await usersCollection.insertOne({
    userName,
    Email,
    Password: hashedPassword,
    createdAt: new Date(),
  });

  return { success: true };
}

// 🔹 Validate user credentials (with caching layer optional)
const userCache = new Map<string, any>(); // simple in-memory cache (FDT style)

export async function validateUser({
  Email,
  Password,
}: {
  Email: string;
  Password: string;
}) {
  // Check cache first (avoid DB hit)
  if (userCache.has(Email)) {
    const cachedUser = userCache.get(Email);
    const isValidPassword = await bcrypt.compare(Password, cachedUser.Password);
    if (isValidPassword) return { success: true, user: cachedUser };
  }

  const db = await connectToDatabase();
  const usersCollection = db.collection("users");

  // Find user in DB
  const user = await usersCollection.findOne({ Email });
  if (!user) {
    return { success: false, message: "Invalid email or password" };
  }

  // Validate password
  const isValidPassword = await bcrypt.compare(Password, user.Password);
  if (!isValidPassword) {
    return { success: false, message: "Invalid email or password" };
  }

  // Save to cache for faster next access
  userCache.set(Email, user);

  return { success: true, user };
}
