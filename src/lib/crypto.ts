import "server-only"

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto"

function getKey() {
  const secret = process.env.ENCRYPTION_KEY ?? process.env.NEXTAUTH_SECRET
  if (!secret) {
    throw new Error("ENCRYPTION_KEY or NEXTAUTH_SECRET must be configured.")
  }

  return createHash("sha256").update(secret).digest()
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()

  return [iv, tag, encrypted].map((part) => part.toString("base64")).join(".")
}

export function decryptSecret(payload: string) {
  const [iv, tag, encrypted] = payload.split(".").map((part) => Buffer.from(part, "base64"))
  const decipher = createDecipheriv("aes-256-gcm", getKey(), iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8")
}
