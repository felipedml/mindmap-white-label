import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export type StoredDiagram = {
  id: string;
  title: string;
  createdAt: string;
  writeToken: string;
  elements: any[];
  appState?: any;
};

export async function saveDiagram(diagram: StoredDiagram) {
  await redis.set(`diagram:${diagram.id}`, diagram);
}

export async function getDiagram(id: string): Promise<StoredDiagram | null> {
  return await redis.get<StoredDiagram>(`diagram:${id}`);
}
