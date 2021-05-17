import {createHash} from 'crypto'
import {readFileSync} from 'fs'
import * as core from '@actions/core'
import * as cache from '@actions/cache'
import {exec, ExecOptions} from '@actions/exec'
import {CacheStatus, uploadCache} from './upload'

async function execWithOutput(
  commandLine: string,
  args: string[] = [],
  options: ExecOptions = {}
): Promise<string> {
  let output = ''
  await exec(commandLine, args, {
    ...options,
    listeners: {
      stdout: (data: Buffer): void => {
        output += data.toString()
      }
    }
  })
  return output.trim()
}

function hashString(content: string): string {
  const sha256 = createHash('sha256')
  return sha256.update(content).digest('hex')
}

function hashFile(filePath: string): string {
  return hashString(readFileSync(filePath).toString())
}

async function poetryInstall(args: string): Promise<void> {
  await exec(`poetry install ${args}`)
}

async function checkModule(moduleName: string): Promise<number> {
  return await exec('poetry', ['run', 'python', '-c', `import ${moduleName}`], {
    ignoreReturnCode: true
  })
}

async function getVersionHash(): Promise<string> {
  let versionString = ''
  versionString += await execWithOutput('python', [
    '-c',
    'import sys;print(sys.executable+"\\n"+sys.version)'
  ])
  versionString += await execWithOutput('poetry', ['-V'])
  return hashString(versionString)
}

async function checkAndReinstall(
  moduleToCheck: string,
  installArgs: string
): Promise<void> {
  core.startGroup('Validate install')
  if (await checkModule(moduleToCheck)) {
    await poetryInstall(installArgs)
    // Check again after install
    if (await checkModule(moduleToCheck)) {
      await exec('poetry', ['env', 'remove', 'python'])
      await poetryInstall(installArgs)
      // Check again after another install
      if (await checkModule(moduleToCheck)) {
        throw new Error(
          `Fail to import ensured module "${moduleToCheck}"` +
            ` even after re-install`
        )
      }
    }
  }
  core.endGroup()
}

async function sedReplaceMirror(replaceMirror: string): Promise<void> {
  await core.group('Replace poetry install mirror', async () => {
    for (const file of ['poetry.lock', 'pyproject.toml'])
      await exec('sed', ['-i', `s/${replaceMirror}/g`, file])
  })
}

function checkInput(): void {
  const knownUploadStrategies = ['immediate', 'on-success']
  const uploadStrategy = core.getInput('upload-strategy')
  if (!knownUploadStrategies.includes(uploadStrategy)) {
    throw new Error(
      'Value of upload-strategy must be one of ' +
        `${knownUploadStrategies}, not ${uploadStrategy}`
    )
  }
}

async function run(): Promise<void> {
  try {
    checkInput()
    process.chdir(core.getInput('working-directory'))

    core.startGroup('Get system info')
    const versionHash = await getVersionHash()
    const cachePath = await execWithOutput('poetry', ['config', 'cache-dir'])
    core.endGroup()

    core.startGroup('Restore cache')
    const cacheKeyPrefix = core.getInput('cache-key-prefix')
    const restoreKey = `${cacheKeyPrefix}-${versionHash}`
    const cacheKey = `${restoreKey}-${hashFile('poetry.lock')}`
    core.info(`Looking for cache key ${cacheKey}`)
    const restored = await cache.restoreCache([cachePath], cacheKey, [
      restoreKey
    ])
    const cacheHit = restored === cacheKey
    core.info(`Restored ${cachePath} from ${restored}, hit ${cacheHit}`)
    core.setOutput('cache-hit', cacheHit)
    core.endGroup()

    const replaceMirror = core.getInput('replace-mirror')
    if (replaceMirror) sedReplaceMirror(replaceMirror)

    const installArgs = core.getInput('install-args')

    if (!cacheHit)
      await core.group(
        'Run poetry install',
        async () => await poetryInstall(installArgs)
      )

    const moduleToCheck = core.getInput('ensure-module')
    if (moduleToCheck) checkAndReinstall(moduleToCheck, installArgs)

    const cacheStatus: CacheStatus = {
      hit: cacheHit,
      paths: [cachePath],
      key: cacheKey
    }
    if (core.getInput('upload-strategy') === 'immediate') {
      await uploadCache(cacheStatus)
    } else {
      core.saveState('cacheStatus', cacheStatus)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
