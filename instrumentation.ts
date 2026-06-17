export async function register() {
  const vaultAddr = process.env.VAULT_ADDR
  const vaultToken = process.env.VAULT_TOKEN

  if (!vaultAddr || !vaultToken) return

  const paths = ['secret/data/widget-agent', 'secret/data/widget-agent-extra']

  try {
    for (const path of paths) {
      const res = await fetch(`${vaultAddr}/v1/${path}`, {
        headers: { 'X-Vault-Token': vaultToken },
      })
      if (!res.ok) continue

      const json = await res.json()
      const secrets: Record<string, string> = json?.data?.data ?? {}

      for (const [key, value] of Object.entries(secrets)) {
        if (process.env[key] === undefined) {
          process.env[key] = value
        }
      }
    }
    console.log('[vault] Secrets loaded from Vault')
  } catch (err) {
    console.warn('[vault] Vault unavailable — using env file secrets:', err)
  }
}
