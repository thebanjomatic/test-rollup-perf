import {execaNode} from 'execa';
import {setTimeout} from 'timers/promises';
import {copyFile, writeFile, readdir, open, mkdir} from 'fs/promises';
import {existsSync} from 'fs';
import {performance} from 'perf_hooks';
import process from 'process';
import {basename, join} from 'path';

async function testRollup() {
  await execaNode('./test.js');
}

function getStats(times) {
  const mean = times.reduce((acc, time) => acc + time, 0) / times.length;
  const stdDev = times.length > 1 ? Math.sqrt(times.reduce((acc, time) => acc + Math.pow(time - mean, 2), 0) / (times.length - 1)) : 0;
  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  return {mean, stdDev, median};
}

async function runTest(i, iterations, testName, log, execTestCase, times, timeout) {
  await copyFile(join(`./rollup-tests/${testName}.js`), './node_modules/rollup/dist/es/shared/node-entry.js');
  const precision = 7;
  const padSize = iterations.toString().length;
  const start = performance.now();
  await execTestCase();
  
  const end = performance.now();
  const buildTime = (end - start) / 1000;
  times.push(buildTime);
  const {mean, median, stdDev} = getStats(times);
  const count = (i + 1).toString().padStart(padSize);
  log(`${count} / ${iterations} | Last: ${buildTime.toFixed(precision)} s | Average: ${mean.toFixed(precision)} s | Median: ${median.toFixed(precision)} | StdDev: ${stdDev.toFixed(precision)} s`);
  await setTimeout(timeout);
}

let started = false;
let requestedShutdown = false;
process.on('SIGINT', () => {
  if (!started) {
    process.exit(0);
  }
  else if (requestedShutdown) {
    process.exit(1);
  } else {
    requestedShutdown = true;
    console.log('Shutting down after all test cases have finished the current iteration... [Ctrl+C] again to force shutdown');
  }
})

function printSummary(testName, {mean, median, stdDev}) {
  console.log();
  console.log(`${testName} results:`);
  console.log(`Average Build Time: ${mean} seconds`);
  console.log(`Median Build Time: ${median} seconds`);
  console.log(`Standard Deviation: ${stdDev} seconds`);
  console.log();
}


const iterations = Number.parseInt(process.argv[2] ?? '50');

if (!existsSync('./results')) {
  await mkdir('./results');
}

const inputs = await readdir('./rollup-tests');
const testNames = inputs.map((input) => basename(input, '.js'));
const labelPad = testNames.reduce((acc, testName) => Math.max(acc, testName.length + 2), 0);
const inputData = await Promise.all(
  testNames.map(async (testName) => {
    const output = await open(`./results/${testName}.log`, 'w');
    const outputStream = output.createWriteStream();
    const label = `[${testName}]`;

    const log = async (message = '') => {
      console.log(`${label.padEnd(labelPad)} ${message}`);
      outputStream.write(message + '\n');
    }
    return {times: [], testName, output, outputStream, log};
  }
));

const testCase = testRollup;
const timeout = 4000;

console.log('Discarding the first iteration...');
for (const {testName} of inputData) {
  await runTest(1, 1, testName, () => {}, testCase, [], timeout);
}

started = true;
for (let i = 0; i < iterations; i++) {
  for (const {input, times, testName, log} of inputData) {
    await runTest(i, iterations, testName, log, testCase, times, timeout);
  }
  if (requestedShutdown) {
    if (i < iterations - 1) {
      console.log('---------------------------------------------------------------------------------------------------')
      console.log(`!!! Process was terminated early, only ${i + 1} of ${iterations + 1} iterations were completed. !!!`)
      console.log('---------------------------------------------------------------------------------------------------')
    }
    break;
  }
}


for(const {times, testName, output, outputStream} of inputData) {
  const summary = getStats(times);
  printSummary(testName, summary);
  outputStream.end();
  output.close();
}

let csv = testNames.map((label) => `"${label}"`).join(',') + '\n';
for (let i = 0; i < iterations; i++) {
  csv += inputData
    .map(({times}) => `"${times[i]}"`)
    .join(',') + '\n';
}
await writeFile('./results/results.csv', csv, 'utf-8');
