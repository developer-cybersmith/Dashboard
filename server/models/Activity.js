import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    who:        { type: String, default: 'System' },
    action:     { type: String, default: 'updated' },
    entity:     { type: String, default: 'project' },
    entityName: { type: String, default: '' },
    message:    { type: String, required: true },
    type:       { type: String, default: 'project' },
  },
  {
    collection: 'activity',
    timestamps: true,
    versionKey: false,
  },
);

export const Activity = mongoose.model('Activity', activitySchema);
