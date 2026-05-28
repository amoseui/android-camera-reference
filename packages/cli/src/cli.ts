#!/usr/bin/env node
import { cac } from 'cac';
import { extractCommand } from './extract-cmd.js';
import { validateCommand } from './validate-cmd.js';
import { buildCommand } from './build-cmd.js';

const cli = cac('acref');

cli
  .command('extract', 'Extract knowledge nodes for given targets')
  .option('--target <n>', 'AOSP target API level (integer)', { default: 35 })
  .option('--out <dir>', 'generated/ output directory', { default: 'generated' })
  .action(async (opts: { target: number; out: string }) => {
    const r = await extractCommand({ target: Number(opts.target), out: opts.out });
    console.log(`Extracted ${r.nodeCount} nodes for target ${r.target} → ${r.outDir}`);
  });

cli
  .command('validate', 'Validate generated/ directory')
  .option('--in <dir>', 'generated/ input', { default: 'generated' })
  .option('--out <dir>', 'validation output', { default: 'dist/validation' })
  .option('--strict', 'fail on warn', { default: false })
  .action(async (opts: { in: string; out: string; strict: boolean }) => {
    const r = await validateCommand({ in: opts.in, out: opts.out, strict: opts.strict });
    console.log(`Validation: ${r.status} (schema=${r.schemaErrors}, xref=${r.xrefBroken})`);
    if (r.status === 'FAIL') process.exit(1);
  });

cli
  .command('build', 'Build dist/ index from generated/')
  .option('--in <dir>', 'generated/ input', { default: 'generated' })
  .option('--out <dir>', 'dist/ output', { default: 'packages/data/dist' })
  .option('--data-version <v>', 'package version label', { default: '0.0.1' })
  .action(async (opts: { in: string; out: string; dataVersion: string }) => {
    const r = await buildCommand(opts);
    console.log(`Built ${r.files.length} files in ${opts.out}`);
  });

cli.help();
cli.version('0.0.1');
cli.parse();
