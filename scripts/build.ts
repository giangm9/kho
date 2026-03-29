#!/usr/bin/env node

/**
 * Build production bundle for Kho library
 */

import * as esbuild from "esbuild";
import * as fs from "fs";
import * as path from "path";

const DIST_DIR = path.join(process.cwd(), "dist");
const SRC_DIR = path.join(process.cwd(), "src");

async function build() {
    console.log("📦 Building production bundle...\n");

    // Clean dist directory
    if (fs.existsSync(DIST_DIR)) {
        fs.rmSync(DIST_DIR, { recursive: true });
    }
    fs.mkdirSync(DIST_DIR, { recursive: true });
    fs.mkdirSync(path.join(DIST_DIR, "react"), { recursive: true });
    fs.mkdirSync(path.join(DIST_DIR, "vue"), { recursive: true });
    fs.mkdirSync(path.join(DIST_DIR, "systems"), { recursive: true });

    // Build core library - ESM
    console.log("Building core library (ESM)...");
    await esbuild.build({
        entryPoints: [path.join(SRC_DIR, "index.ts")],
        bundle: true,
        outfile: path.join(DIST_DIR, "index.js"),
        format: "esm",
        minify: true,
        sourcemap: true,
        platform: "browser",
        target: "es2020",
        logLevel: "info",
    });

    // Build core library - CJS
    console.log("Building core library (CJS)...");
    await esbuild.build({
        entryPoints: [path.join(SRC_DIR, "index.ts")],
        bundle: true,
        outfile: path.join(DIST_DIR, "index.cjs"),
        format: "cjs",
        minify: true,
        sourcemap: true,
        platform: "node",
        target: "node16",
        logLevel: "info",
    });

    // Build React bindings - ESM
    console.log("Building React bindings (ESM)...");
    await esbuild.build({
        entryPoints: [path.join(SRC_DIR, "react", "index.ts")],
        bundle: true,
        outfile: path.join(DIST_DIR, "react", "index.js"),
        format: "esm",
        minify: true,
        sourcemap: true,
        platform: "browser",
        target: "es2020",
        external: ["react", "react-dom"],
        logLevel: "info",
    });

    // Build React bindings - CJS
    console.log("Building React bindings (CJS)...");
    await esbuild.build({
        entryPoints: [path.join(SRC_DIR, "react", "index.ts")],
        bundle: true,
        outfile: path.join(DIST_DIR, "react", "index.cjs"),
        format: "cjs",
        minify: true,
        sourcemap: true,
        platform: "node",
        target: "node16",
        external: ["react", "react-dom"],
        logLevel: "info",
    });

    // Build Vue bindings - ESM
    console.log("Building Vue bindings (ESM)...");
    await esbuild.build({
        entryPoints: [path.join(SRC_DIR, "vue", "index.ts")],
        bundle: true,
        outfile: path.join(DIST_DIR, "vue", "index.js"),
        format: "esm",
        minify: true,
        sourcemap: true,
        platform: "browser",
        target: "es2020",
        external: ["vue"],
        logLevel: "info",
    });

    // Build Vue bindings - CJS
    console.log("Building Vue bindings (CJS)...");
    await esbuild.build({
        entryPoints: [path.join(SRC_DIR, "vue", "index.ts")],
        bundle: true,
        outfile: path.join(DIST_DIR, "vue", "index.cjs"),
        format: "cjs",
        minify: true,
        sourcemap: true,
        platform: "node",
        target: "node16",
        external: ["vue"],
        logLevel: "info",
    });

    // Build Systems - ESM
    console.log("Building Systems (ESM)...");
    await esbuild.build({
        entryPoints: [path.join(SRC_DIR, "systems", "index.ts")],
        bundle: true,
        outfile: path.join(DIST_DIR, "systems", "index.js"),
        format: "esm",
        minify: true,
        sourcemap: true,
        platform: "browser",
        target: "es2020",
        logLevel: "info",
    });

    // Build Systems - CJS
    console.log("Building Systems (CJS)...");
    await esbuild.build({
        entryPoints: [path.join(SRC_DIR, "systems", "index.ts")],
        bundle: true,
        outfile: path.join(DIST_DIR, "systems", "index.cjs"),
        format: "cjs",
        minify: true,
        sourcemap: true,
        platform: "node",
        target: "node16",
        logLevel: "info",
    });

    // Generate type definitions using TypeScript compiler
    console.log("Generating type definitions...");
    const { execSync } = await import("child_process");
    const tscFlags =
        "--declaration --emitDeclarationOnly --declarationMap --esModuleInterop --moduleResolution node --target ES2020 --module ESNext --skipLibCheck --rootDir src";
    execSync(`npx tsc ${tscFlags} --outDir dist src/index.ts src/types.ts src/data/*.ts src/system/*.ts`, {
        cwd: process.cwd(),
        stdio: "inherit",
    });
    execSync(`npx tsc ${tscFlags} --outDir dist src/react/index.ts`, {
        cwd: process.cwd(),
        stdio: "inherit",
    });
    execSync(`npx tsc ${tscFlags} --outDir dist src/vue/index.ts`, {
        cwd: process.cwd(),
        stdio: "inherit",
    });
    execSync(`npx tsc ${tscFlags} --outDir dist src/systems/index.ts src/systems/ecs-bind.ts`, {
        cwd: process.cwd(),
        stdio: "inherit",
    });

    // Calculate bundle sizes
    const coreEsmSize = fs.statSync(path.join(DIST_DIR, "index.js")).size;
    const coreCjsSize = fs.statSync(path.join(DIST_DIR, "index.cjs")).size;
    const reactEsmSize = fs.statSync(
        path.join(DIST_DIR, "react", "index.js"),
    ).size;
    const reactCjsSize = fs.statSync(
        path.join(DIST_DIR, "react", "index.cjs"),
    ).size;
    const vueEsmSize = fs.statSync(
        path.join(DIST_DIR, "vue", "index.js"),
    ).size;
    const vueCjsSize = fs.statSync(
        path.join(DIST_DIR, "vue", "index.cjs"),
    ).size;
    const systemsEsmSize = fs.statSync(
        path.join(DIST_DIR, "systems", "index.js"),
    ).size;
    const systemsCjsSize = fs.statSync(
        path.join(DIST_DIR, "systems", "index.cjs"),
    ).size;

    console.log("\n✅ Build complete!");
    console.log("   Core:");
    console.log(`     ESM: ${(coreEsmSize / 1024).toFixed(2)} KB`);
    console.log(`     CJS: ${(coreCjsSize / 1024).toFixed(2)} KB`);
    console.log("   React:");
    console.log(`     ESM: ${(reactEsmSize / 1024).toFixed(2)} KB`);
    console.log(`     CJS: ${(reactCjsSize / 1024).toFixed(2)} KB`);
    console.log("   Vue:");
    console.log(`     ESM: ${(vueEsmSize / 1024).toFixed(2)} KB`);
    console.log(`     CJS: ${(vueCjsSize / 1024).toFixed(2)} KB`);
    console.log("   Systems:");
    console.log(`     ESM: ${(systemsEsmSize / 1024).toFixed(2)} KB`);
    console.log(`     CJS: ${(systemsCjsSize / 1024).toFixed(2)} KB\n`);
}

build().catch((error) => {
    console.error("❌ Build failed:", error);
    process.exit(1);
});
