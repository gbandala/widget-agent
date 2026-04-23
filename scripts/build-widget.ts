import * as esbuild from 'esbuild'
import { statSync } from 'fs'

void (async () => {
  const result = await esbuild.build({
    entryPoints: ['src/widget/loader.ts'],
    bundle: true,
    minify: true,
    format: 'iife',
    outfile: 'public/widget.js',
    // Broad browser compatibility — no transforms needed beyond es2018
    target: ['es2018', 'chrome70', 'firefox65', 'safari12', 'edge79'],
    legalComments: 'none',
  })

  if (result.errors.length > 0) {
    process.exit(1)
  }

  const { size } = statSync('public/widget.js')
  console.log(`✓ public/widget.js — ${(size / 1024).toFixed(1)} KB minified`)
})()
