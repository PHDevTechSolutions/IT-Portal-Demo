import { connectToDatabase } from "../../MongoDB";
import { Collection, ObjectId } from "mongodb";

export interface IPantsIn {
  _id?: ObjectId;
  ReferenceID: string;
  Email: string;
  Type: string;
  Status: string;
  Location?: string;
  Latitude?: number;
  Longitude?: number;
  PhotoURL?: string;
  date_created?: Date;
  archived?: boolean;
}

// Get the TaskLog collection
export async function getTaskLogCollection(): Promise<Collection<IPantsIn>> {
  const db = await connectToDatabase();
  return db.collection<IPantsIn>("TaskLog");
}

// Collection methods - accepts any for MongoDB operators
export const TaskLog = {
  async find(filter: any = {}) {
    const collection = await getTaskLogCollection();
    return collection.find(filter).toArray();
  },
  
  async findOne(filter: any) {
    const collection = await getTaskLogCollection();
    return collection.findOne(filter);
  },
  
  async countDocuments(filter: any = {}) {
    const collection = await getTaskLogCollection();
    return collection.countDocuments(filter);
  },
  
  async create(data: Omit<IPantsIn, "_id">) {
    const collection = await getTaskLogCollection();
    const result = await collection.insertOne({
      ...data,
      date_created: data.date_created || new Date()
    } as any);
    return result;
  },
  
  async updateOne(filter: any, update: any) {
    const collection = await getTaskLogCollection();
    return collection.updateOne(filter, update);
  },
  
  async updateMany(filter: any, update: any) {
    const collection = await getTaskLogCollection();
    return collection.updateMany(filter, update);
  },
  
  async deleteOne(filter: any) {
    const collection = await getTaskLogCollection();
    return collection.deleteOne(filter);
  },
  
  async deleteMany(filter: any) {
    const collection = await getTaskLogCollection();
    return collection.deleteMany(filter);
  }
};
