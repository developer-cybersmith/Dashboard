import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { isMongoActive } from '../config/db.js';
import { ProjectDocument } from '../models/ProjectDocument.js';
import { Project } from '../models/Project.js';
import { nextNumericId } from '../utils/seed.js';
import { readJson, writeJson } from '../utils/jsonStore.js';
import {
  getProjectUploadDir,
  readDocuments,
  writeDocuments,
  nextDocumentId,
} from '../utils/documentStore.js';
import { recordActivity } from '../utils/activityLog.js';

const ALLOWED_KINDS = new Set(['invoice', 'po']);

function normalizeKind(kind) {
  const k = String(kind || '').toLowerCase();
  if (k === 'pos' || k === 'purchase-order' || k === 'purchase_order') return 'po';
  return k;
}

function assertKind(kind) {
  const k = normalizeKind(kind);
  if (!ALLOWED_KINDS.has(k)) {
    const err = new Error('kind must be "invoice" or "po"');
    err.status = 400;
    throw err;
  }
  return k;
}

const storage = multer.diskStorage({
  destination(req, _file, cb) {
    try {
      const kind = assertKind(req.params.kind);
      const projectId = Number(req.params.projectId);
      cb(null, getProjectUploadDir(kind, projectId));
    } catch (err) {
      cb(err);
    }
  },
  filename(_req, file, cb) {
    const safe = String(file.originalname || 'file.pdf')
      .replace(/[^a-zA-Z0-9._-]+/g, '_')
      .slice(0, 120);
    cb(null, `${Date.now()}-${safe}`);
  },
});

function pdfFilter(_req, file, cb) {
  const ok =
    file.mimetype === 'application/pdf' ||
    String(file.originalname || '').toLowerCase().endsWith('.pdf');
  if (!ok) {
    cb(new Error('Only PDF files are allowed'));
    return;
  }
  cb(null, true);
}

export const uploadPdf = multer({
  storage,
  fileFilter: pdfFilter,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});

async function projectExists(projectId) {
  if (isMongoActive()) {
    const found = await Project.findOne({ id: Number(projectId) }).lean();
    return Boolean(found);
  }
  const data = readJson();
  return (data.projects || []).some((p) => Number(p.id) === Number(projectId));
}

function toPublic(doc) {
  return {
    id: doc.id,
    projectId: doc.projectId,
    kind: doc.kind,
    originalName: doc.originalName,
    size: doc.size,
    mimeType: doc.mimeType || 'application/pdf',
    uploadedBy: doc.uploadedBy || '',
    uploadedAt: doc.uploadedAt
      ? new Date(doc.uploadedAt).toISOString()
      : new Date().toISOString(),
  };
}

export async function listByProject(req, res) {
  try {
    const kind = assertKind(req.params.kind);
    const projectId = Number(req.params.projectId);
    if (!projectId) return res.status(400).json({ error: 'Invalid projectId' });

    if (isMongoActive()) {
      const docs = await ProjectDocument.find(
        { projectId, kind },
        { _id: 0, storedName: 0, __v: 0 },
      )
        .sort({ uploadedAt: -1 })
        .lean();
      return res.json(docs.map(toPublic));
    }

    const docs = readDocuments()
      .filter((d) => Number(d.projectId) === projectId && d.kind === kind)
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .map(toPublic);
    return res.json(docs);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

export async function listAll(req, res) {
  try {
    const kind = assertKind(req.params.kind);

    if (isMongoActive()) {
      const docs = await ProjectDocument.find(
        { kind },
        { _id: 0, storedName: 0, __v: 0 },
      )
        .sort({ uploadedAt: -1 })
        .lean();
      return res.json(docs.map(toPublic));
    }

    const docs = readDocuments()
      .filter((d) => d.kind === kind)
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .map(toPublic);
    return res.json(docs);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
}

export async function upload(req, res) {
  try {
    const kind = assertKind(req.params.kind);
    const projectId = Number(req.params.projectId);
    if (!projectId) return res.status(400).json({ error: 'Invalid projectId' });
    if (!(await projectExists(projectId))) {
      return res.status(404).json({ error: 'Project not found' });
    }
    if (!req.file) return res.status(400).json({ error: 'PDF file is required' });

    const uploadedBy = req.user?.name || req.user?.email || 'System';
    const record = {
      projectId,
      kind,
      originalName: req.file.originalname || req.file.filename,
      storedName: req.file.filename,
      size: req.file.size || 0,
      mimeType: req.file.mimetype || 'application/pdf',
      uploadedBy,
      uploadedAt: new Date(),
    };

    if (isMongoActive()) {
      const id = await nextNumericId(ProjectDocument);
      const doc = await ProjectDocument.create({ id, ...record });
      const { _id, __v, storedName, ...plain } = doc.toObject();
      await recordActivity({
        message: `Uploaded ${kind === 'invoice' ? 'invoice' : 'PO'} PDF "${record.originalName}" for project #${projectId}`,
        type: kind === 'invoice' ? 'invoice' : 'po',
        who: uploadedBy,
        action: 'uploaded',
        entity: kind,
        entityName: record.originalName,
        changes: [
          { field: kind === 'invoice' ? 'Invoice PDF' : 'PO PDF', from: '', to: record.originalName },
          { field: 'File size', from: '', to: `${record.size} bytes` },
        ],
      });
      return res.status(201).json(toPublic({ ...plain, storedName }));
    }

    const docs = readDocuments();
    const id = nextDocumentId(docs);
    const stored = {
      id,
      ...record,
      uploadedAt: record.uploadedAt.toISOString(),
    };
    docs.push(stored);
    writeDocuments(docs);
    return res.status(201).json(toPublic(stored));
  } catch (err) {
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }
    res.status(err.status || 500).json({ error: err.message });
  }
}

async function findDoc(id) {
  if (isMongoActive()) {
    return ProjectDocument.findOne({ id: Number(id) }).lean();
  }
  return readDocuments().find((d) => Number(d.id) === Number(id)) ?? null;
}

export async function download(req, res) {
  try {
    const doc = await findDoc(req.params.fileId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const filePath = path.join(
      getProjectUploadDir(doc.kind, doc.projectId),
      doc.storedName,
    );
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File missing on disk' });
    }

    res.setHeader('Content-Type', doc.mimeType || 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${String(doc.originalName).replace(/"/g, '')}"`,
    );
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

export async function remove(req, res) {
  try {
    const fileId = Number(req.params.fileId);
    const doc = await findDoc(fileId);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const filePath = path.join(
      getProjectUploadDir(doc.kind, doc.projectId),
      doc.storedName,
    );
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    }

    if (isMongoActive()) {
      await ProjectDocument.deleteOne({ id: fileId });
      await recordActivity({
        message: `Deleted ${doc.kind === 'invoice' ? 'invoice' : 'PO'} PDF "${doc.originalName}" from project #${doc.projectId}`,
        type: doc.kind === 'invoice' ? 'invoice' : 'po',
        who: req.user?.name || req.user?.email || 'System',
        action: 'deleted',
        entity: doc.kind,
        entityName: doc.originalName,
        changes: [
          { field: doc.kind === 'invoice' ? 'Invoice PDF' : 'PO PDF', from: doc.originalName, to: '(removed)' },
        ],
      });
    } else {
      writeDocuments(readDocuments().filter((d) => Number(d.id) !== fileId));
    }

    res.json({ ok: true, deleted: toPublic(doc) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

/** Patch paymentReceived / invoiceComment / poComment on a project. */
export async function patchProjectBilling(req, res) {
  try {
    const projectId = Number(req.params.projectId);
    if (!projectId) return res.status(400).json({ error: 'Invalid projectId' });

    const patch = {};
    if (req.body?.paymentReceived != null) {
      patch.paymentReceived = Math.max(0, Number(req.body.paymentReceived) || 0);
    }
    if (req.body?.invoiceComment != null) {
      patch.invoiceComment = String(req.body.invoiceComment);
    }
    if (req.body?.poComment != null) {
      patch.poComment = String(req.body.poComment);
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ error: 'No billing fields provided' });
    }

    if (isMongoActive()) {
      const existing = await Project.findOne({ id: projectId }).lean();
      if (!existing) return res.status(404).json({ error: 'Project not found' });

      const updated = await Project.findOneAndUpdate(
        { id: projectId },
        { $set: patch },
        { returnDocument: 'after', projection: { _id: 0 } },
      ).lean();

      const changes = [];
      if (patch.paymentReceived != null && Number(existing.paymentReceived || 0) !== patch.paymentReceived) {
        changes.push({
          field: 'Payment Received',
          from: `₹${Number(existing.paymentReceived || 0).toLocaleString('en-IN')}`,
          to: `₹${patch.paymentReceived.toLocaleString('en-IN')}`,
        });
      }
      if (patch.invoiceComment != null && String(existing.invoiceComment || '') !== patch.invoiceComment) {
        changes.push({
          field: 'Invoice Comment',
          from: String(existing.invoiceComment || '') || '—',
          to: patch.invoiceComment || '—',
        });
      }
      if (patch.poComment != null && String(existing.poComment || '') !== patch.poComment) {
        changes.push({
          field: 'PO Comment',
          from: String(existing.poComment || '') || '—',
          to: patch.poComment || '—',
        });
      }

      if (changes.length > 0) {
        await recordActivity({
          message: `Billing updated for project "${existing.projectName || '#' + projectId}" (${changes.length} field${changes.length === 1 ? '' : 's'})`,
          type: patch.poComment != null && patch.paymentReceived == null && patch.invoiceComment == null ? 'po' : 'invoice',
          who: req.user?.name || req.user?.email || 'System',
          action: 'updated',
          entity: 'project',
          entityName: existing.projectName || String(projectId),
          changes,
        });
      }

      return res.json(updated);
    }

    const data = readJson();
    const projects = data.projects || [];
    const idx = projects.findIndex((p) => Number(p.id) === projectId);
    if (idx === -1) return res.status(404).json({ error: 'Project not found' });
    projects[idx] = { ...projects[idx], ...patch };
    writeJson({ ...data, projects });
    return res.json(projects[idx]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
