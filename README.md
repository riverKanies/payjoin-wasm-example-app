# WASM App Example

## Server app to test a WASM package
```
npm install
npm start
```
open browser to http://localhost:8080/
open browser console to see scan rusults


## Build WASM package

By default the example will pull the bitcoindevkit package from npm.
However, if you want to pull from the local package (say for development) modify the dependency in the package.json and build:

`"bitcoindevkit": "file:../bdk-wasm/pkg"`

From bdk-wasm folder (the wasm-package):

`wasm-pack build --features esplora`

### Mac Users

Note: to build successfully on mac required installing llvm with homebrew (even though there's a default version) https://github.com/bitcoindevkit/bdk/issues/1671#issuecomment-2456858895
And properly pointing to it in which is being done in .cargo and .vscode folders

### Non-Mac Users

You may need to delete the .cargo and .vscode folders, our point them to the appropriate llvm version.