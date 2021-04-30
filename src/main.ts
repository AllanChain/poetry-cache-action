import {createHash} from 'crypto'
import {readFileSync} from 'fs'
import * as core from '@actions/core'
import * as cache from '@actions/cache'
import {exec, ExecOptions} from '@actions/exec'

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

async function run(): Promise<void> {
  try {
    process.chdir(core.getInput('working-directory'))

    core.startGroup('Get system info')
    let versionString = ''
    versionString += await execWithOutput('python', [
      '-c',
      'import sys;print(sys.executable+"\\n"+sys.version)'
    ])
    versionString += await execWithOutput('poetry', ['-V'])
    const cachePath = await execWithOutput('poetry', ['config', 'cache-dir'])
    core.endGroup()

    core.startGroup('Restore cache')
    const cacheKeyPrefix = core.getInput('cache-key-prefix')
    const restoreKey = `${cacheKeyPrefix}-${hashString(versionString)}`
    const cacheKey = `${restoreKey}-${hashFile('poetry.lock')}`
    const restored = await cache.restoreCache([cachePath], cacheKey, [
      restoreKey
    ])
    const cacheHit = restored === cacheKey
    core.setOutput('cache-hit', cacheHit)
    core.endGroup()

    const replaceMirror = core.getInput('replace-mirror')
    if (replaceMirror) {
      await core.group('Replace poetry install mirror', async () => {
        for (const file of ['poetry.lock', 'pyproject.toml'])
          await exec('sed', ['-i', `s/${replaceMirror}/g`, file])
      })
    }

    const installArgs = core.getInput('install-args')

    if (!cacheHit)
      await core.group(
        'Run poetry install',
        async () => await poetryInstall(installArgs)
      )

    const moduleToCheck = core.getInput('ensure-module')
    if (moduleToCheck) {
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
              `Fail to import ensured module "${moduleToCheck}" even after re-install`
            )
          }
        }
      }
      core.endGroup()

      if (!cacheHit)
        await core.group(
          'Upload cache',
          async () => await cache.saveCache([cachePath], cacheKey)
        )
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

run()
