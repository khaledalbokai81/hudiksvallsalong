import mongoose from "mongoose";
import type { MongoMemoryServer } from "mongodb-memory-server";
import { config } from "./config.js";
import { logger } from "./logger.js";

let connectionPromise: Promise<typeof mongoose> | null = null;
let memoryServer: MongoMemoryServer | undefined;

const safeTestDatabasePattern = /^booking_api_test_\d+$/;
const developmentFallbackDatabaseName = "booking_api_dev_memory";

function getConfiguredDatabaseName() {
  if (config.MONGODB_DB_NAME) {
    return config.MONGODB_DB_NAME;
  }

  try {
    return new URL(config.MONGODB_URL).pathname.replace(/^\//, "");
  } catch {
    return undefined;
  }
}

export function assertSafeTestDatabaseTarget() {
  const databaseName = mongoose.connection.db?.databaseName || getConfiguredDatabaseName();

  if (config.NODE_ENV !== "test" || !databaseName || !safeTestDatabasePattern.test(databaseName)) {
    throw new Error(
      `Refusing destructive test database operation for database "${databaseName || "unknown"}"`
    );
  }
}

export function connectDatabase() {
  if (connectionPromise) {
    return connectionPromise;
  }

  if (config.NODE_ENV === "test") {
    const databaseName = getConfiguredDatabaseName();

    if (!databaseName || !safeTestDatabasePattern.test(databaseName)) {
      throw new Error(
        `Refusing to run tests against unsafe MongoDB database "${databaseName || "unknown"}"`
      );
    }
  }

  async function connectAndInitialize(url: string, dbName?: string) {
    const connection = await mongoose.connect(url, {
      dbName,
      serverSelectionTimeoutMS: config.MONGODB_SERVER_SELECTION_TIMEOUT_MS,
      connectTimeoutMS: config.MONGODB_CONNECT_TIMEOUT_MS
    });

    await Promise.all(Object.values(connection.models).map((model) => model.init()));
    return connection;
  }

  connectionPromise = connectAndInitialize(
    config.MONGODB_URL,
    config.MONGODB_DB_NAME || undefined
  )
    .then(async (connection) => {
      return connection;
    })
    .catch(async (error: unknown) => {
      connectionPromise = null;

      if (config.NODE_ENV === "test") {
        const message =
          "Could not connect to the test MongoDB instance. Start MongoDB on the configured MONGODB_URL or set MONGODB_URL to an isolated test database before running npm run test:api.";
        const wrappedError = new Error(message);

        wrappedError.cause = error;
        throw wrappedError;
      }

      if (config.NODE_ENV === "development" && config.MONGODB_DEV_FALLBACK_MEMORY) {
        logger.warn("MongoDB connection failed; starting in-memory development database", {
          error
        });

        const { MongoMemoryServer } = await import("mongodb-memory-server");

        memoryServer = await MongoMemoryServer.create({
          instance: {
            dbName: developmentFallbackDatabaseName
          }
        });

        return connectAndInitialize(memoryServer.getUri(), developmentFallbackDatabaseName);
      }

      throw error;
    });

  return connectionPromise;
}

export async function dropSafeTestDatabase() {
  assertSafeTestDatabaseTarget();
  await mongoose.connection.db?.dropDatabase();
}

export async function stopMemoryDatabase() {
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = undefined;
  }
}
