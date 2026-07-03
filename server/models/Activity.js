import mongoose from 'mongoose';

const changeSchema = new mongoose.Schema(
  { field: String, from: String, to: String },
  { _id: false },
);

const activitySchema = new mongoose.Schema(
  {
    who:        { type: String, default: 'System' },
    action:     { type: String, default: 'updated' },
    entity:     { type: String, default: 'project' },
    entityName: { type: String, default: '' },
    message:    { type: String, required: true },
    type:       { type: String, default: 'project' },
    changes:    { type: [changeSchema], default: [] },
  },
  {
    collection: 'activity',
    timestamps: true,
    versionKey: false,
  },
);

export const Activity = mongoose.model('Activity', activitySchema);
