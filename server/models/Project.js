import mongoose from 'mongoose';

const testerSchema = new mongoose.Schema(
  {
    name:       { type: String, default: '' },
    monthlyPay: { type: Number, default: 0 },
  },
  { _id: false },
);

const projectSchema = new mongoose.Schema(
  {
    id:               { type: Number, required: true, unique: true },
    company:          { type: String, default: '', trim: true },
    projectName:      { type: String, required: true, trim: true },
    category:         { type: String, default: '', trim: true },
    projectLead:      { type: String, default: '', trim: true },
    income:           { type: Number, default: 0 },
    startDate:        { type: String, default: '' },
    endDate:          { type: String, default: '' },
    completedWork:    { type: String, default: '' },
    pendingWork:      { type: String, default: '' },
    completedPercent: { type: Number, default: 0, min: 0, max: 100 },
    testers:          { type: [testerSchema], default: [] },
  },
  {
    collection: 'projects',
    timestamps: true,
    versionKey: false,
  },
);

export const Project = mongoose.model('Project', projectSchema);
