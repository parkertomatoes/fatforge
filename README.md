# FATForge

This is a little in-browser client-side FAT image editor that is useful for updating floppy and hard disk images when using PC emulators.

Features
  - Create and edit FAT floppy and hard-disk images
  - Create, rename, move, and delete files and folders
  - Simple text editing
  - Hex viewer for binary files
  - LFN support
  - Familiar Windows 9x look and feel
  - Entirely client-side, deploys to static web servers

## Running
```
vite
```

## Building
```
npm run build
```

## Testing
```
npm run test
```

## License
This project is licensed under the [MIT license](https://opensource.org/license/mit)

## Development
Sloppily made with Codex and GPT 5.5 over a weekend and uses the following stack:
  - [React](https://react.dev/)/[Zustand](https://github.com/pmndrs/zustand) for front-end
  - [Vite/vitest](https://vite.dev/) for bundling and testing
  - [98.css](https://jdan.github.io/98.css/) for styling 
  - [Dockview](https://dockview.dev/) for tabs and panels
  - [Monaco](https://microsoft.github.io/monaco-editor/) for text editing
  - [Lucide](https://lucide.dev/guide/react/) for additional icons
  - [fatfs-wasm](https://github.com/parkertomatoes/fatfs-wasm) for FAT image operations
