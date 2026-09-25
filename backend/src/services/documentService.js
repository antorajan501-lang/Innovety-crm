const prisma = require('../utils/db');

/**
 * Service to manage employee documents (Aadhaar, PAN, Resume, Offer Letter, Certificates, Agreements)
 * with version history tracking and verification.
 */

const DOCUMENT_TYPES = [
  'AADHAAR',
  'PAN',
  'RESUME',
  'OFFER_LETTER',
  'CERTIFICATES',
  'AGREEMENTS',
  'OTHER'
];

const uploadEmployeeDocument = async ({
  organizationId,
  userId,
  documentType = 'OTHER',
  title,
  fileName,
  filePath,
  fileSize,
  mimeType,
  notes,
  actorId
}) => {
  if (!organizationId || !userId || !fileName || !filePath) {
    throw new Error('Organization ID, user ID, file name, and file path are required.');
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId }
  });
  if (!user) {
    throw new Error('Employee not found.');
  }

  const normalizedType = documentType.trim().toUpperCase();

  // Check if an existing document of this type exists for user
  const existingDoc = await prisma.employeeDocument.findFirst({
    where: {
      organizationId,
      userId,
      documentType: normalizedType
    }
  });

  if (existingDoc) {
    // 1. Archive current version to history
    await prisma.employeeDocumentHistory.create({
      data: {
        documentId: existingDoc.id,
        version: existingDoc.version,
        fileName: existingDoc.fileName,
        filePath: existingDoc.filePath,
        fileSize: existingDoc.fileSize,
        uploadedById: existingDoc.uploadedById,
        changeNotes: notes || `Replaced by version ${existingDoc.version + 1}`
      }
    });

    // 2. Update existing document with new version
    const updated = await prisma.employeeDocument.update({
      where: { id: existingDoc.id },
      data: {
        title: title || existingDoc.title,
        fileName,
        filePath,
        fileSize: fileSize || existingDoc.fileSize,
        mimeType: mimeType || existingDoc.mimeType,
        version: existingDoc.version + 1,
        status: 'VERIFIED',
        notes: notes || existingDoc.notes,
        uploadedById: actorId || null
      },
      include: {
        history: { orderBy: { version: 'desc' } }
      }
    });

    return updated;
  }

  // Initial version 1 creation
  const doc = await prisma.employeeDocument.create({
    data: {
      organizationId,
      userId,
      documentType: normalizedType,
      title: title || `${normalizedType} Document`,
      fileName,
      filePath,
      fileSize: fileSize || null,
      mimeType: mimeType || 'application/pdf',
      version: 1,
      status: 'VERIFIED',
      notes: notes || null,
      uploadedById: actorId || null
    }
  });

  return doc;
};

const getUserDocuments = async ({ userId, organizationId }) => {
  const where = { userId };
  if (organizationId) where.organizationId = organizationId;

  const docs = await prisma.employeeDocument.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      uploadedBy: {
        select: { id: true, name: true, employeeId: true }
      },
      history: {
        orderBy: { version: 'desc' }
      }
    }
  });

  return docs;
};

const getDocumentById = async (documentId, organizationId) => {
  const where = { id: documentId };
  if (organizationId) where.organizationId = organizationId;

  const doc = await prisma.employeeDocument.findFirst({
    where,
    include: {
      user: {
        select: { id: true, name: true, employeeId: true, department: true }
      },
      uploadedBy: {
        select: { id: true, name: true }
      },
      history: {
        orderBy: { version: 'desc' }
      }
    }
  });

  if (!doc) {
    throw new Error('Document not found.');
  }

  return doc;
};

const getDocumentVersionHistory = async (documentId, organizationId) => {
  const doc = await getDocumentById(documentId, organizationId);
  return {
    current: {
      id: doc.id,
      version: doc.version,
      fileName: doc.fileName,
      filePath: doc.filePath,
      fileSize: doc.fileSize,
      updatedAt: doc.updatedAt
    },
    history: doc.history || []
  };
};

const verifyDocument = async ({ documentId, organizationId, status = 'VERIFIED', notes }) => {
  const where = { id: documentId };
  if (organizationId) where.organizationId = organizationId;

  const doc = await prisma.employeeDocument.findFirst({ where });
  if (!doc) {
    throw new Error('Document not found.');
  }

  const updated = await prisma.employeeDocument.update({
    where: { id: documentId },
    data: {
      status,
      notes: notes || doc.notes
    }
  });

  return updated;
};

const getDocumentVaultOverview = async (organizationId) => {
  const where = organizationId ? { organizationId } : {};

  const [totalDocs, verifiedDocs, pendingDocs, byTypeRaw] = await Promise.all([
    prisma.employeeDocument.count({ where }),
    prisma.employeeDocument.count({ where: { ...where, status: 'VERIFIED' } }),
    prisma.employeeDocument.count({ where: { ...where, status: 'PENDING' } }),
    prisma.employeeDocument.findMany({
      where,
      select: { documentType: true }
    })
  ]);

  const typeCounts = {};
  for (const t of DOCUMENT_TYPES) {
    typeCounts[t] = 0;
  }
  for (const item of byTypeRaw) {
    typeCounts[item.documentType] = (typeCounts[item.documentType] || 0) + 1;
  }

  return {
    totalDocs,
    verifiedDocs,
    pendingDocs,
    typeCounts
  };
};

module.exports = {
  DOCUMENT_TYPES,
  uploadEmployeeDocument,
  getUserDocuments,
  getDocumentById,
  getDocumentVersionHistory,
  verifyDocument,
  getDocumentVaultOverview
};
