import * as core from '@actions/core'
import {CacheStatus, uploadCache} from './upload'

async function run(): Promise<void> {
  if (core.getInput('upload-strategy') === 'on-success') {
    const cacheStatus: CacheStatus = JSON.parse(core.getState('cacheStatus'))
    await uploadCache(cacheStatus)
  }
}

run()
