# Poetry Cache Action

Are you annoyed by random CI failure because poetry cache strangely becomes invalid? This action is for you!

poetry-cache-action is an action to handle poetry **package** caching and installation, with utilities to handle tricky cases.

## Features

- cache and install pacakges
- validate cache and try reinstall
- hack to replace mirror url for ci (python-poetry/poetry#1632)

## Usage Example

```yaml
- uses: actions/checkout@v3
- uses: actions/setup-python@v4
- uses: Gr1N/setup-poetry@v8
- uses: allanchain/poetry-cache-action@release # or any other tags
```

## Inputs

### `cache-key-prefix`

This action internally uses `@actions/cache` for caching. By default it generates a hash string based on python version, python installation path, and poetry version. You can add a custom key prefix to have more control over caching.

Default to `'poetry'`

### `ensure-module`

One highlight feature of this action is auto checking cache by importing a module specified by `ensure-module`, and tring to reinstall if import fails.

Default to `'pytest'`

### `install-args`

Any args after `poetry install`. Seperated by spaces, as normally do in command line. e.g.:

```yaml
install-args: --no-root --no-dev
```

Default to `''`

### `replace-mirror`

Hack to replace mirror url for ci ([python-poetry/poetry#1632](https://github.com/python-poetry/poetry/issues/1632)).

The string is passed to sed: `sed -i 's/${replaceMirror}/g'`. e.g.:

```yaml
replace-mirror: pypi.tuna.tsinghua.edu.cn/pypi.org
```

Default to do nothing.

### `working-directory`

Working directory of th poetry project.

Default to current directory.

### `upload-strategy`

When to upload updated cache. `'immediate'` means upload the cache immediately after installing all the packages. `'on-success'` means upload cache after everything is successfully done, just like the official cache action does.

Both of the strategies are useful. Sometime you want to update the cache even though tests fail. And sometimes you just need the default behavior of the official cache action, or rely on cache hit status to do something, or maybe caching all the pyc files.

Default to `'immediate'`

## Outputs

### `cache-hit`

Whether the cache is resored from the exact key.
