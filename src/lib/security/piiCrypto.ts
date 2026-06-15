import crypto from 'crypto'

export function encryptPii(text: string): string {
  const key = process.env.PII_ENCRYPTION_KEY
  if (!key) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PII_ENCRYPTION_KEY no configurada')
    }
    return text
  }
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32)), iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export function decryptPii(enc: string): string {
  const key = process.env.PII_ENCRYPTION_KEY
  if (!key) return enc
  const [ivHex, dataHex] = enc.split(':')
  if (!ivHex || !dataHex) return enc
  const iv = Buffer.from(ivHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.slice(0, 32)), iv)
  const decrypted = Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()])
  return decrypted.toString('utf8')
}
