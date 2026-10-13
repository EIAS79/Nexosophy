import { z } from "zod";
const uuid=z.string().uuid();

export const createLabProjectSchema=z.object({
  name:z.string().trim().min(1).max(240),
  description:z.string().max(200000).default(""),
  classification:z.enum(["internal","restricted","confidential"]).default("internal"),
  restricted:z.boolean().default(false),
});
export const createExperimentSchema=z.object({
  projectId:uuid,title:z.string().trim().min(1).max(500),
  objective:z.string().max(200000).default(""),
  hypothesis:z.string().max(200000).default(""),
  plannedStartAt:z.string().datetime().optional(),
  plannedEndAt:z.string().datetime().optional(),
});
export const createElnEntrySchema=z.object({
  projectId:uuid,experimentId:uuid.optional(),title:z.string().trim().min(1).max(500),
});
export const createObservationSchema=z.object({
  text:z.string().trim().min(1).max(500000),kind:z.string().max(120).default("note"),
  observedAt:z.string().datetime().optional(),structured:z.record(z.string(),z.unknown()).default({}),
});
export const linkElnSchema=z.object({
  targetType:z.enum(["sample","inventory_lot","protocol_version","asset","dataset","equipment","node"]),
  targetId:z.string().min(1).max(300),label:z.string().max(300).optional(),
});
export const signElnSchema=z.object({reason:z.string().trim().min(1).max(10000)});
export const amendElnSchema=z.object({
  reason:z.string().trim().min(1).max(10000),
  title:z.string().trim().min(1).max(500).default("Amendment"),
  body:z.string().max(500000).default(""),
});
export const createProtocolSchema=z.object({
  name:z.string().trim().min(1).max(300),description:z.string().max(200000).default(""),
  category:z.string().max(200).optional(),
});
export const createProtocolVersionSchema=z.object({
  title:z.string().trim().min(1).max(500),purpose:z.string().max(200000).default(""),
  materials:z.array(z.record(z.string(),z.unknown())).max(1000).default([]),
  hazards:z.array(z.record(z.string(),z.unknown())).max(1000).default([]),
  expectedDurationMinutes:z.number().int().positive().max(100000).optional(),
  changeReason:z.string().max(10000).optional(),
  steps:z.array(z.object({
    instruction:z.string().trim().min(1).max(200000),
    durationSeconds:z.number().int().nonnegative().max(31536000).optional(),
    parameters:z.record(z.string(),z.unknown()).default({}),
    safetyNotes:z.string().max(100000).optional(),
  })).min(1).max(1000),
});
export const approveProtocolSchema=z.object({reason:z.string().trim().min(1).max(10000)});
export const createExperimentRunSchema=z.object({
  experimentId:uuid,protocolVersionId:uuid.optional(),parameters:z.record(z.string(),z.unknown()).default({}),
});
export const updateExperimentRunSchema=z.object({
  expectedVersion:z.number().int().positive(),
  status:z.enum(["planned","running","completed","failed","cancelled"]).optional(),
  parameters:z.record(z.string(),z.unknown()).optional(),
  results:z.record(z.string(),z.unknown()).optional(),
});
export const createDeviationSchema=z.object({description:z.string().trim().min(1).max(200000),reason:z.string().trim().min(1).max(10000)});
export const createStorageLocationSchema=z.object({
  parentId:uuid.optional(),name:z.string().trim().min(1).max(300),kind:z.string().max(120).default("storage"),
  temperatureC:z.number().min(-273.15).max(1000).optional(),metadata:z.record(z.string(),z.unknown()).default({}),
});
export const createSampleSchema=z.object({
  projectId:uuid.optional(),name:z.string().trim().min(1).max(300),sampleType:z.string().max(200).optional(),
  barcode:z.string().max(300).optional(),locationId:uuid.optional(),metadata:z.record(z.string(),z.unknown()).default({}),
});
export const lineageSchema=z.object({parentSampleId:uuid,childSampleId:uuid,relationship:z.string().max(120).default("derived")});
export const createInventoryItemSchema=z.object({
  name:z.string().trim().min(1).max(300),category:z.string().max(200).optional(),baseUnit:z.string().trim().min(1).max(80),
  catalogNumber:z.string().max(200).optional(),vendor:z.string().max(300).optional(),sdsAssetId:uuid.optional(),
  hazards:z.array(z.unknown()).max(500).default([]),lowStockThreshold:z.number().nonnegative().optional(),
  responsibleUserId:uuid.optional(),
});
export const createInventoryLotSchema=z.object({
  itemId:uuid,lotNumber:z.string().trim().min(1).max(300),locationId:uuid.optional(),
  receivedAt:z.string().datetime().optional(),expiryDate:z.string().date().optional(),
  quantity:z.number().nonnegative(),
});
export const inventoryTransactionSchema=z.object({
  type:z.enum(["receive","consume","adjust","transfer","dispose"]),
  quantity:z.number(),unit:z.string().trim().min(1).max(80),reason:z.string().trim().min(1).max(10000),
});
export const reserveInventorySchema=z.object({
  quantity:z.number().positive(),unit:z.string().trim().min(1).max(80),purpose:z.string().max(10000).default(""),
});
export const createEquipmentSchema=z.object({
  name:z.string().trim().min(1).max(300),category:z.string().max(200).optional(),
  serialNumber:z.string().max(300).optional(),locationId:uuid.optional(),manualAssetId:uuid.optional(),
  responsibleUserId:uuid.optional(),trainingRequirement:z.string().max(500).optional(),metadata:z.record(z.string(),z.unknown()).default({}),
});
export const recordTrainingSchema=z.object({
  userId:uuid,requirement:z.string().trim().min(1).max(500),completedAt:z.string().datetime(),
  validUntil:z.string().datetime().optional(),evidenceAssetId:uuid.optional(),
});
export const createBookingSchema=z.object({
  equipmentId:uuid,startsAt:z.string().datetime(),endsAt:z.string().datetime(),timezone:z.string().max(120).default("UTC"),
  experimentRunId:uuid.optional(),purpose:z.string().max(10000).default(""),
});
export const createMaintenanceSchema=z.object({
  equipmentId:uuid,kind:z.string().trim().min(1).max(200),startsAt:z.string().datetime(),
  endsAt:z.string().datetime().optional(),description:z.string().max(200000).default(""),performedBy:z.string().max(300).optional(),
});
export const createCalibrationSchema=z.object({
  equipmentId:uuid,performedAt:z.string().datetime(),validUntil:z.string().datetime().optional(),
  result:z.string().trim().min(1).max(10000),certificateAssetId:uuid.optional(),performedBy:z.string().max(300).optional(),
});
export const createLabPolicySchema=z.object({
  name:z.string().trim().min(1).max(300),content:z.string().min(1).max(500000),
  requiresAcknowledgement:z.boolean().default(false),reasonForChangeRequired:z.boolean().default(false),
});
export const createLegalHoldSchema=z.object({projectId:uuid.optional(),reason:z.string().trim().min(1).max(10000)});
export const complianceExportSchema=z.object({
  projectId:uuid.optional(),format:z.enum(["json","csv"]).default("json"),
  scope:z.enum(["project","inventory","equipment","audit","workspace"]).default("workspace"),
});
