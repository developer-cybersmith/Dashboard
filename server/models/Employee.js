import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    id:          { type: Number, required: true, unique: true },
    name:        { type: String, required: true, trim: true },
    designation: { type: String, default: '', trim: true },
    monthlyPay:  { type: Number, default: 0, min: 0 },
  },
  {
    collection: 'employees',
    timestamps: true,
    versionKey: false,
  },
);

export const Employee = mongoose.model('Employee', employeeSchema);
