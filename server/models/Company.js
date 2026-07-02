import mongoose from 'mongoose';

const companySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },
  },
  {
    collection: 'companies',
    timestamps: true,
    versionKey: false,
  },
);

export const Company = mongoose.model('Company', companySchema);
