import { OceanClientNode } from './nodeService'

export async function getNodeEnvs(peerId: string) {
  const client = new OceanClientNode()

  try {
    await client.initialize()

    await new Promise((resolve) => setTimeout(resolve, 3000))

    const result = await client.sendCommand(peerId, {
      command: 'getComputeEnvironments'
    })

    return result
  } catch (error) {
    console.error('Error getting node envs:', error)
  } finally {
    await client.stop()
  }
}
