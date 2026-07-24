const HEX = "0123456789abcdef";

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) {
    out += HEX[b >> 4];
    out += HEX[b & 0xf];
  }
  return out;
}

/** Canonical internal id (UUID v4). Never use provider ids as primary keys. */
export function createId(): string {
  const bytes = randomBytes(16);
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = toHex(bytes);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isId(value: string): boolean {
  return UUID_RE.test(value);
}

export type EntityId = string & { readonly __brand: "EntityId" };

export function asEntityId(value: string): EntityId {
  if (!isId(value)) {
    throw new Error(`Invalid entity id: ${value}`);
  }
  return value as EntityId;
}
