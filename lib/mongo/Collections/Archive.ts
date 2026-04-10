import { connectToDatabase } from "../../MongoDB";
import { Collection, ObjectId } from "mongodb";

export interface IArchive {
  _id?: ObjectId;
  originalId?: ObjectId;
  ReferenceID: string;
  Email: string;
  Type: string;
  Status: string;
  Location?: string;
  Latitude?: number;
  Longitude?: number;
  PhotoURL?: string;
  date_created?: Date;
  archivedAt: Date;
  source: string;
}

// Get the Archive collection
export async function getArchiveCollection(): Promise<Collection<IArchive>> {
  const db = await connectToDatabase();
  return db.collection<IArchive>("archive");
}

// Collection methods
export const Archive = {
  async find(filter: Partial<IArchive> = {}) {
    const collection = await getArchiveCollection();
    return collection.find(filter).toArray();
  },
  
  async findOne(filter: Partial<IArchive>) {
    const collection = await getArchiveCollection();
    return collection.findOne(filter);
  },
  
  async countDocuments(filter: Partial<IArchive> = {}) {
    const collection = await getArchiveCollection();
    return collection.countDocuments(filter);
  },
  
  async create(data: Omit<IArchive, "_id">) {
    const collection = await getArchiveCollection();
    const result = await collection.insertOne({
      ...data,
      archivedAt: data.archivedAt || new Date()
    });
    return result;
  },
  
  async createMany(data: Omit<IArchive, "_id">[]) {
    const collection = await getArchiveCollection();
    const result = await collection.insertMany(
      data.map(item => ({
        ...item,
        archivedAt: item.archivedAt || new Date()
      }))
    );
    return result;
  },
  
  async deleteOne(filter: Partial<IArchive>) {
    const collection = await getArchiveCollection();
    return collection.deleteOne(filter);
  },
  
  async deleteMany(filter: Partial<IArchive>) {
    const collection = await getArchiveCollection();
    return collection.deleteMany(filter);
  },
  
  async updateOne(filter: Partial<IArchive>, update: Partial<IArchive>) {
    const collection = await getArchiveCollection();
    return collection.updateOne(filter, { $set: update });
  },
  
  async updateMany(filter: Partial<IArchive>, update: Partial<IArchive>) {
    const collection = await getArchiveCollection();
    return collection.updateMany(filter, { $set: update });
  }
};
