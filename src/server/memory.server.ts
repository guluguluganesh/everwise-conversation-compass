import { MongoClient } from "mongodb";

export type MemoryType = "mistake" | "preference" | "coding_style" | "fact";
export interface MemoryDoc {
  userId: string;
  type: MemoryType;
  content: string;
  context?: string;
  createdAt: Date;
}

let clientPromise: Promise<MongoClient> | null = null;

async function getCollection() {
  const uri = process.env['MONGODB_URI'];
  if (!uri) throw new Error("MONGODB_URI is not configured");
  if (!clientPromise) {
    clientPromise = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 }).connect().catch((e) => {
      clientPromise = null;
      throw e;
    });
  }
  const client = await clientPromise;
  return client.db("chatbot_memory").collection<MemoryDoc>("memories");
}

export async function loadMemories(userId: string): Promise<MemoryDoc[]> {
  try {
    const col = await getCollection();
    return await col.find({ userId }).sort({ createdAt: -1 }).limit(200).toArray();
  } catch (e) {
    console.error("Mongo load failed", e);
    return [];
  }
}

export async function saveMemory(doc: Omit<MemoryDoc, "createdAt">) {
  const col = await getCollection();
  const exists = await col.findOne({ userId: doc.userId, type: doc.type, content: doc.content });
  if (exists) return;
  await col.insertOne({ ...doc, createdAt: new Date() });
}

export function memoriesToPrompt(mems: MemoryDoc[]): string {
  if (!mems.length) return "";
  const group = (t: MemoryType) => mems.filter((m) => m.type === t).map((m) => `- ${m.content}`).join("\n");
  const sections = [
    ["PAST MISTAKES — you made these before. NEVER repeat them; actively check your answer against each", group("mistake")],
    ["USER PREFERENCES", group("preference")],
    ["USER CODING STYLE", group("coding_style")],
    ["FACTS ABOUT THE USER", group("fact")],
  ].filter(([, v]) => v);
  return "\n\n# Long-term memory\n" + sections.map(([h, v]) => `## ${h}\n${v}`).join("\n\n");
}
