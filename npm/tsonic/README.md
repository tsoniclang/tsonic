# tsonic

CLI package for the Tsonic compiler.

## Install

```bash
npm install -g tsonic
```

Or use locally:

```bash
npm install --save-dev tsonic
```

## Usage

### Initialize a workspace

Default CLR surface:

```bash
tsonic init
```

JS surface:

```bash
tsonic init --surface @tsonic/js
```

### Build and run

```bash
tsonic build
tsonic run
```

### Add dependencies

```bash
tsonic add npm @tsonic/nodejs
tsonic add nuget Microsoft.Extensions.Logging 10.0.0
tsonic add package ./libs/MyCompany.MyLib.dll
tsonic restore
```

## Requirements

- Node.js 22+
- .NET 10 SDK

## Docs

- `https://tsonic.org/tsonic/`
- `https://github.com/tsoniclang/tsonic`
