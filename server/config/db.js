import mongoose from 'mongoose';

let _active = false;

export async function connectDB() {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    console.log('[DB] MONGO_URI not set — using JSON file storage');
    return;
  }

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    _active = true;

    mongoose.connection.on('disconnected', () => {
      _active = false;
      console.warn('[DB] MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      _active = true;
      console.log('[DB] MongoDB reconnected');
    });

    console.log('[DB] MongoDB connected to:', mongoose.connection.db.databaseName);
  } catch (err) {
    _active = false;
    console.error('[DB] Connection failed:', err.message);
    console.warn('[DB] Falling back to JSON file storage');
  }
}

export const isMongoActive = () => _active;
