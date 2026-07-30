import mongoose, { Schema } from "mongoose";

export type SchedulerLeaseDocument = {
  key: string;
  ownerId: string;
  expiresAt: Date;
  heartbeatAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const schedulerLeaseSchema = new Schema<SchedulerLeaseDocument>(
  {
    key: { type: String, required: true, unique: true, trim: true, index: true },
    ownerId: { type: String, required: true, trim: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    heartbeatAt: { type: Date, required: true, default: Date.now }
  },
  { timestamps: true }
);

export const SchedulerLease =
  mongoose.models.SchedulerLease ||
  mongoose.model<SchedulerLeaseDocument>("SchedulerLease", schedulerLeaseSchema);
