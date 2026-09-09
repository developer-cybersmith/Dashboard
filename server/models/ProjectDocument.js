import mongoose from 'mongoose';

/**
 * Metadata for uploaded invoice / purchase-order PDFs.
 * Binary files live on disk under data/uploads/{kind}/{projectId}/.
 */
const projectDocumentSchema = new mongoose.Schema(
  {
    id:           { type: Number, required: true, unique: true },
    projectId:    { type: Number, required: true, index: true },
    kind:         { type: String, required: true, enum: ['invoice', 'po'] },
    originalName: { type: String, required: true, trim: true },
    storedName:   { type: String, required: true, trim: true },
    size:         { type: Number, default: 0 },
    mimeType:     { type: String, default: 'application/pdf' },
    uploadedBy:   { type: String, default: '', trim: true },
    uploadedAt:   { type: Date, default: Date.now },
  },
  {
    collection: 'project_documents',
    timestamps: true,
    versionKey: false,
  },
);

projectDocumentSchema.index({ projectId: 1, kind: 1 });

export const ProjectDocument = mongoose.model('ProjectDocument', projectDocumentSchema);
