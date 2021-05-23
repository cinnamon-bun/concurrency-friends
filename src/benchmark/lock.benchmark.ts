import { makeDeferred } from '../deferred';
import { Lock } from '../lock';
import { BenchmarkRunner } from './benchmark-runner';

let log = console.log;

export let benchmarkLock = async (runner: BenchmarkRunner) => {
    runner.setScenario('lock');
    let lock: Lock<number>;
    let exampleSyncFunction = () => { return 7; };
    let exampleAsyncFunction = async () => { return 7; };

    let iters = 100000;
    let itersString = Number(iters).toLocaleString('en-US');

    await runner.runOnce(`...for comparison: run sync function ${itersString} times.`, {actualIters: iters}, async () => {
        for (let ii = 0; ii < iters; ii++) {
            exampleSyncFunction();
        }
    });

    await runner.runOnce(`...for comparison: run async function ${itersString} times.`, {actualIters: iters}, async () => {
        for (let ii = 0; ii < iters; ii++) {
            await exampleAsyncFunction();
        }
    });

    type Scenario = [() => number | Promise<number>, string];
    let scenarios: Scenario[] = [[exampleSyncFunction, 'synchronous'], [exampleAsyncFunction, 'async']];

    for (let scenario of scenarios) {
        let [fn, scenarioName] = scenario;
        lock = new Lock<number>();
        await runner.runOnce(`lock: ${itersString} fns, one at a time, ${scenarioName}.`, {actualIters: iters}, async () => {
            for (let ii = 0; ii < iters; ii++) {
                await lock.run(fn);
            }
        });
    }

    for (let scenario of scenarios) {
        let [fn, scenarioName] = scenario;
        lock = new Lock<number>();
        await runner.runOnce(`lock: ${itersString} fns, sets of ten, ${scenarioName}.`, {actualIters: iters}, async () => {
            for (let ii = 0; ii < iters/10; ii++) {
                lock.run(fn);
                lock.run(fn);
                lock.run(fn);
                lock.run(fn);
                lock.run(fn);
                lock.run(fn);
                lock.run(fn);
                lock.run(fn);
                lock.run(fn);
                await lock.run(fn);
            }
        });
    }

    for (let scenario of scenarios) {
        let [fn, scenarioName] = scenario;
        lock = new Lock();
        await runner.runOnce(`lock: ${itersString} fns, dump in without awaiting, ${scenarioName}.`, {actualIters: iters}, async () => {
            for (let ii = 0; ii < iters - 1; ii++) {
                lock.run(fn);
            }
            await lock.run(fn);  // just wait for the last one
        });
    }

}
