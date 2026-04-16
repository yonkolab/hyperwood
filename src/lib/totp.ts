import { createHmac, randomBytes } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;

function encodeBase32(buffer: Buffer) {
  let bits = 0;
  let value = 0;
  let output = "";

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return output;
}

function decodeBase32(value: string) {
  const normalized = value.toUpperCase().replace(/=+$/g, "");
  let bits = 0;
  let current = 0;
  const output: number[] = [];

  for (const char of normalized) {
    const index = BASE32_ALPHABET.indexOf(char);

    if (index === -1) {
      throw new Error("invalid base32 secret");
    }

    current = (current << 5) | index;
    bits += 5;

    if (bits >= 8) {
      output.push((current >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

function generateHotp(secret: Buffer, counter: number) {
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac("sha1", secret).update(counterBuffer).digest();
  const offset = digest.readUInt8(digest.length - 1) & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;

  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

export function generateTotpSecret() {
  return encodeBase32(randomBytes(20));
}

export function buildTotpOtpAuthUri(params: {
  issuer: string;
  accountName: string;
  secret: string;
}) {
  const issuer = encodeURIComponent(params.issuer);
  const accountName = encodeURIComponent(params.accountName);
  const secret = encodeURIComponent(params.secret);

  return `otpauth://totp/${issuer}:${accountName}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

export function verifyTotpCode(params: {
  secret: string;
  code: string;
  now?: Date;
  window?: number;
}) {
  const trimmedCode = params.code.trim();

  if (!/^\d{6}$/.test(trimmedCode)) {
    return false;
  }

  const secret = decodeBase32(params.secret);
  const now = params.now ?? new Date();
  const window = params.window ?? 1;
  const counter = Math.floor(now.getTime() / 1000 / TOTP_STEP_SECONDS);

  for (let offset = -window; offset <= window; offset += 1) {
    if (generateHotp(secret, counter + offset) === trimmedCode) {
      return true;
    }
  }

  return false;
}
