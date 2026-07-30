import mongoose, { Schema } from "mongoose";

export type LoginAttemptScope = "admin" | "monitor";

export type LoginAttemptDocument = {
  key: string;
  scope: LoginAttemptScope;
  failures: number;
  lockedUntil?: Date;
  lastFailureAt: Date;
  expiresAt: Date;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
};

const loginAttemptSchema = new Schema<LoginAttemptDocument>(
  {
    key: { type: String, required: true, unique: true, index: true },
    scope: { type: String, enum: ["admin", "monitor"], required: true, index: true },
    failures: { type: Number, required: true, default: 0 },
    lockedUntil: { type: Date, index: true },
    lastFailureAt: { type: Date, required: true, default: Date.now },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true }
  },
  { timestamps: true }
);

loginAttemptSchema.index({ scope: 1, lockedUntil: 1 });

export const LoginAttempt =
  mongoose.models.LoginAttempt ||
  mongoose.model<LoginAttemptDocument>("LoginAttempt", loginAttemptSchema);
