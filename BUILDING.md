# Electron POS Build Guide: Packaging & Executable Compilation

This guide explains how to package the Offline Mart POS system into standalone executables. The application is built using **Electron**, **Vite**, **TypeScript**, and **React**. Crucially, it relies on two **native Node.js modules** (addons compiled from C/C++ source code):
1. **`better-sqlite3`** (Local high-performance database)
2. **`escpos-usb`** (Direct USB thermal receipt printer interface)

---

## ⚡ The Native Addon Cross-Compilation Challenge

Because `better-sqlite3` and `escpos-usb` contain compiled native C/C++ code, they must be built specifically for the Target Operating System and architecture (e.g., Windows x64 or Linux x64) using the matching compiler and platform headers.

> [!WARNING]
> **Cross-compiling from Linux to Windows with native C/C++ addons is highly complex and error-prone.** 
> While pure JavaScript/TypeScript Electron apps can easily build for any OS from a single machine, applications with native addons require native compilers (like MSVC on Windows and GCC/Clang on Linux) to build correctly.
> 
> **Recommendation:** 
> - **To build a Windows `.exe`:** Perform the build on a Windows machine, or use a CI/CD pipeline (such as GitHub Actions) with a Windows runner.
> - **To build a Linux executable/package:** Perform the build on your current Linux machine.

---

## 💻 Method 1: Building a Windows Executable (`.exe`) on Windows

This is the most direct and reliable way to get a production Windows `.exe` installer.

### Step 1: Install Prerequisites on the Windows Machine
1. **Node.js**: Download and install the LTS version of Node.js from [nodejs.org](https://nodejs.org/).
2. **Windows Build Tools** (Required to compile native modules like `better-sqlite3`):
   - Open PowerShell or Command Prompt as **Administrator** and run:
     ```powershell
     npm install --global --production windows-build-tools
     ```
   - *Alternative:* Install **Visual Studio Community** and select the **Desktop development with C++** workload during installation.

### Step 2: Clone/Transfer your Project
Copy your project folder (without the `node_modules` and `out` folders to avoid cross-platform permission conflicts) onto the Windows machine.

### Step 3: Install Dependencies and Build
Open a terminal in the root directory of your project on the Windows machine and run:

```bash
# 1. Clean install all dependencies (this automatically compiles better-sqlite3 for Windows)
npm install

# 2. Package the app into a standalone executable directory
npm run package

# 3. Create a production distribution installer (e.g., Squirrel Windows Installer)
npm run make
```

### Step 4: Locate the Executables
- Standalone Folder (contains `offline-mart-pos.exe`): Check `out/offline-mart-pos-win32-x64/`
- Installer Package (`.exe` installer): Check `out/make/squirrel.windows/x64/`

---

## 🐧 Method 2: Building for Linux (On Your Current Machine)

Since you are running Linux, you can package the application for Linux instantly.

### Step 1: Package as a Standalone Folder
To quickly build a portable folder that runs out-of-the-box on Linux:
```bash
npm run package
```
*Output Path:* `out/offline-mart-pos-linux-x64/` (contains the binary executable `offline-mart-pos`).

### Step 2: Create Installers (`.deb`, `.rpm`, `.zip`)
To package the app into standard, ready-to-distribute Linux installer packages:
```bash
npm run make
```
*Output Paths:*
- **Debian/Ubuntu (`.deb`):** Check `out/make/deb/x64/`
- **RedHat/Fedora (`.rpm`):** Check `out/make/rpm/x64/`
- **Zip Archive (`.zip`):** Check `out/make/zip/linux/x64/`

---

## 🤖 Method 3: Automated Multi-Platform builds via GitHub Actions (Highly Recommended)

The most professional way to build executables for **Windows (`.exe`)**, **Linux (`.deb`/`.rpm`)**, and **macOS** is to let a cloud runner compile them automatically whenever you release a new version.

Here is a ready-to-use GitHub Actions workflow file.

### Setup Instructions:
1. In your project workspace, create the folders `.github` and then `.github/workflows/`:
   ```bash
   mkdir -p .github/workflows
   ```
2. Create a file called `build.yml` in `.github/workflows/`.
3. Paste the following configuration into it:

```yaml
name: Build and Release Electron POS App

on:
  push:
    tags:
      - 'v*' # Triggers workflow on tag pushes starting with 'v' (e.g. v1.0.0)
  workflow_dispatch: # Allows manual trigger from the GitHub UI

jobs:
  build:
    name: Build on ${{ matrix.os }}
    runs-on: ${{ matrix.os }}
    
    strategy:
      matrix:
        # Cross-builds on all platforms to compile the respective native dependencies
        os: [windows-latest, ubuntu-latest]

    steps:
      - name: Checkout Source Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-size: '20'
          cache: 'npm'

      - name: Install System Dependencies (Linux Only)
        if: matrix.os == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y rpm libusb-1.0-0-dev libudev-dev

      - name: Clean Install Dependencies
        run: npm ci

      - name: Compile and Make Packages
        run: npm run make
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Upload Build Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: pos-app-${{ matrix.os }}
          path: out/make/
```

### How to Trigger the Automated Release:
Whenever you are ready to publish a new version of the software:
```bash
git add .
git commit -m "Prepare for Release"
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin main --tags
```
GitHub will spin up dedicated Windows and Linux servers, install dependencies, compile native components like SQLite, package the POS app, and output downloadable `.exe`, `.deb`, and `.rpm` files!

---

## 🛠️ Summary of NPM Packaging Commands

| Command | Action | Primary Output Target |
|:---|:---|:---|
| `npm run dev` | Runs the app in development mode with hot-reloading | Dev Window |
| `npm run package` | Packs the application structure into a fast-running standalone directory | `out/offline-mart-pos-<os>-<arch>/` |
| `npm run make` | Builds target distribution files (`.exe` installer, `.deb`, `.rpm`, `.zip`) | `out/make/` |
