# Poetry Cache Action

Action to handle poetry caching, with utilities to handle tricky cases

## Features

- cache and install pacakges
- validate cache and try reinstall
- hack to replace mirror url for ci (python-poetry/poetry#1632)

## Inputs

```yaml
  cache-key-prefix:
    required: false
    description: 'custom key prefix for @actions/cache, in addition to platform and poetry version'
    default: 'poetry'
  ensure-module:
    required: false
    description: 'make sure this module can be imported after installation, default pytest'
    default: 'pytest'
  install-root:
    required: false
    description: 'if "true", remain poetry default, else use `--no-root` when installing'
    default: 'true'
  replace-mirror:
    required: false
    description: 'replace mirror url, python-poetry/poetry#1632'
    default: ''
  working-directory:
    required: false
    description: 'Working directory of th poetry project'
    default: '.'
```
