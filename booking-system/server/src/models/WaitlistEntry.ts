import mongoose, { Schema } from "mongoose";

export type WaitlistStatus = "waiting" | "notified" | "converted" | "expired" | "canceled";

export type WaitlistEntryDocument = {
  name: string;
  email: string;
  phone: string;
  serviceId: string;
  serviceName: string;
  serviceDurationHours: number;
  slotStartAt: Date;
  slotEndAt: Date;
  status: WaitlistStatus;
  activeKey?: string;
  offerTokenHash?: string;
  offerExpiresAt?: Date;
  notifiedAt?: Date;
  convertedAt?: Date;
  convertedBookingId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

const waitlistEntrySchema = new Schema<WaitlistEntryDocument>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, lowercase: true, trim: true, maxlength: 120 },
    phone: { type: String, required: true, trim: true, maxlength: 30 },
    serviceId: { type: String, required: true, trim: true },
    serviceName: { type: String, required: true, trim: true },
    serviceDurationHours: { type: Number, required: true, min: 1, max: 12 },
    slotStartAt: { type: Date, required: true },
    slotEndAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["waiting", "notified", "converted", "expired", "canceled"],
      required: true,
      default: "waiting"
    },
    activeKey: { type: String, unique: true, sparse: true },
    offerTokenHash: { type: String, unique: true, sparse: true },
    offerExpiresAt: { type: Date },
    notifiedAt: { type: Date },
    convertedAt: { type: Date },
    convertedBookingId: { type: Schema.Types.ObjectId, ref: "Booking" }
  },
  { timestamps: true }
);

waitlistEntrySchema.index({ slotStartAt: 1, status: 1, createdAt: 1 });
waitlistEntrySchema.index({ status: 1, slotStartAt: 1, createdAt: 1 });
waitlistEntrySchema.index({ status: 1, offerExpiresAt: 1 });
waitlistEntrySchema.index({ email: 1, createdAt: -1 });

export const WaitlistEntry =
  mongoose.models.WaitlistEntry ||
  mongoose.model<WaitlistEntryDocument>("WaitlistEntry", waitlistEntrySchema);
