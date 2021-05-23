import {
    Chan,
} from '../chan';
import { makeDeferred } from '../deferred';
import {
    BenchmarkRunner,
} from './benchmark-runner';

//================================================================================

let benchmarkChan = async (runner: BenchmarkRunner) => {
    runner.setScenario('chan');
    let chan: Chan<number>;

    let iters = 150000;
    let itersString = Number(iters).toLocaleString('en-US');

    await runner.runOnce(`...for comparison: plain array.  put.  items: ${itersString}`, {actualIters: iters}, async () => {
        let arr: number[] = [];
        for (let ii = 0; ii < iters; ii++) {
            arr.push(ii);
        }
    });

    await runner.runOnce(`...for comparison: plain array.  alternating put and get.  items: ${itersString}`, {actualIters: iters}, async () => {
        let arr: number[] = [];
        for (let ii = 0; ii < iters/2; ii++) {
            arr.push(ii);
            arr.push(ii);
            arr.shift();
            arr.shift();
        }
    });

    await runner.runOnce(`...for comparison: plain array.  put and get in series.  items: ${itersString}`, {actualIters: iters}, async () => {
        let arr: number[] = [];
        for (let ii = 0; ii < iters; ii++) {
            arr.push(ii);
        }
        for (let ii = 0; ii < iters; ii++) {
            arr.shift();  // shift is very slow on large arrays
        }
    });


    chan = new Chan<number>();
    await runner.runOnce(`chan: put.  items: ${itersString}`, {actualIters: iters}, async () => {
        for (let ii = 0; ii < iters; ii++) {
            await chan.put(ii);
        }
    });
    chan.close();

    chan = new Chan<number>();
    await runner.runOnce(`chan: alternating put and get.  items: ${itersString}`, {actualIters: iters}, async () => {
        for (let ii = 0; ii < iters/2; ii++) {
            await chan.put(ii);
            await chan.put(ii);
            await chan.get();
            await chan.get();
        }
    });
    chan.close();

    chan = new Chan<number>();
    await runner.runOnce(`chan: put and get in series.  items: ${itersString}`, {actualIters: iters}, async () => {
        for (let ii = 0; ii < iters; ii++) {
            await chan.put(ii);
        }
        for (let ii = 0; ii < iters; ii++) {
            await chan.get();
        }
    });
    chan.close();

    for (let CAPACITY of [0, 1, 2, 5, 100, null]) {
        chan = new Chan<number>(CAPACITY);
        await runner.runOnce(`chan: put and get in parallel.  items: ${itersString}; capacity: ${CAPACITY}`, {actualIters: iters}, async () => {
            let d1 = makeDeferred();
            let d2 = makeDeferred();
            queueMicrotask(async () => {
                for (let ii = 0; ii < iters; ii++) {
                    await chan.put(ii);
                }
                d1.resolve(undefined);
            });
            queueMicrotask(async () => {
                for (let ii = 0; ii < iters; ii++) {
                    await chan.get();
                }
                d2.resolve(undefined);
            });
            await d1.promise;
            await d2.promise;
        });
        chan.close();
    }

    chan = new Chan<number>();
    await runner.runOnce(`chan: put, seal, and forEach in series.  items: ${itersString}`, {actualIters: iters}, async () => {
        for (let ii = 0; ii < iters; ii++) {
            await chan.put(ii);
        }
        chan.seal();
        await chan.forEach((item) => {});
    });
    chan.close();

    for (let CAPACITY of [0, 1, 2, 5, 100, null]) {
        chan = new Chan<number>(CAPACITY);
        await runner.runOnce(`chan: put, seal, and forEach in parallel.  items: ${itersString}; capacity: ${CAPACITY}`, {actualIters: iters}, async () => {
            let d1 = makeDeferred();
            let d2 = makeDeferred();
            queueMicrotask(async () => {
                for (let ii = 0; ii < iters; ii++) {
                    await chan.put(ii);
                }
                chan.seal();
                d1.resolve(undefined);
            });
            queueMicrotask(async () => {
                await chan.forEach((item) => {});
                d2.resolve(undefined);
            });
            await d1.promise;
            await d2.promise;
        });
        chan.close();
    }
};

//================================================================================
// MAIN

let runner = new BenchmarkRunner(console.log);
benchmarkChan(runner);

