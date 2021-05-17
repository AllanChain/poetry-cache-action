import * as core from '@actions/core'
import * as cache from '@actions/cache'

export interface CacheStatus {
  hit: boolean
  paths: string[]
  key: string
}

export async function uploadCache({
  hit,
  paths,
  key
}: CacheStatus): Promise<void> {
  if (!hit) {
    await core.group(
      'Upload cache',
      async () => await cache.saveCache(paths, key)
    )
  }
}
