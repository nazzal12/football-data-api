import type { ObjectType } from "./constants.js";

export function metaKey(objectType: ObjectType, objectId: string): string {
  return `meta:${objectType}:${objectId}`;
}

export function objectKey(objectType: ObjectType, objectId: string, generation: number): string {
  return `obj:${objectType}:${objectId}:g${generation}`;
}

export function idMapKey(provider: string, externalType: string, externalId: string): string {
  return `idmap:${provider}:${externalType}:${externalId}`;
}

export function slugIndexKey(objectType: ObjectType, slug: string): string {
  return `slug:${objectType}:${slug}`;
}

export function projectionKey(kind: string, key: string): string {
  return `proj:${kind}:${key}`;
}

export function quotaKey(provider: string): string {
  return `quota:${provider}`;
}
