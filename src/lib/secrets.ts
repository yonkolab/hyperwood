import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function getEncryptionKey(keyHex: string) {
  return Buffer.from(keyHex, "hex");
}

export function encryptString(value: string, keyHex: string) {
  const key = getEncryptionKey(keyHex);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptString(payload: string, keyHex: string) {
  const [ivEncoded, authTagEncoded, encryptedEncoded] = payload.split(".");

  if (!ivEncoded || !authTagEncoded || !encryptedEncoded) {
    throw new Error("invalid encrypted payload");
  }

  const key = getEncryptionKey(keyHex);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivEncoded, "base64url"),
  );

  decipher.setAuthTag(Buffer.from(authTagEncoded, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

