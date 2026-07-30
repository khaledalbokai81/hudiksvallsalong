import mongoose, { Schema } from "mongoose";

export type AuthSessionRole = "admin" | "monitor";

export type AuthSessionDocument = {
  sessionHash: string;
  role: AuthSessionRole;
  version: string;
  expiresAt: Date;
  lastSeenAt: Date;
  revokedAt?: Date;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
};

const authSessionSchema = new Schema<AuthSessionDocument>(
  {
    sessionHash: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ["admin", "monitor"], required: true, index: true },
    version: { type: String, required: true, trim: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    lastSeenAt: { type: Date, required: true, default: Date.now },
    revokedAt: { type: Date, index: true },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true }
  },
  { timestamps: true }
);

authSessionSchema.index({ role: 1, expiresAt: 1 });
authSessionSchema.index({ role: 1, revokedAt: 1 });

export const AuthSession =
  mongoose.models.AuthSession ||
  mongoose.model<AuthSessionDocument>("AuthSession", authSessionSchema);
