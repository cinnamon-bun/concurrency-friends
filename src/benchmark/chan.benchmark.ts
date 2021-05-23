import {
    Chan,
} from '../chan';
import { makeDeferred } from '../deferred';
import {
    BenchmarkRunner,
} from './benchmark-runner';

//================================================================================

let main = async () => {
    let log = console.log;
    let runner = new BenchmarkRunner(log);
    runner.setScenario('chan');
    let chan: Chan<number>;

    let iters = 100000;

    await runner.runOnce(`plain array.  put.  items: ${iters}`, {actualIters: iters}, async () => {
        let arr: number[] = [];
        for (let ii = 0; ii < iters; ii++) {
            arr.push(ii);
        }
    });

    await runner.runOnce(`plain array.  alternating put and get.  items: ${iters}`, {actualIters: iters}, async () => {
        let arr: number[] = [];
        for (let ii = 0; ii < iters; ii++) {
            arr.push(ii);
            arr.push(ii);
            arr.shift();
            arr.shift();
        }
    });

    await runner.runOnce(`plain array.  put and get in series.  items: ${iters}`, {actualIters: iters}, async () => {
        let arr: number[] = [];
        for (let ii = 0; ii < iters; ii++) {
            arr.push(ii);
        }
        for (let ii = 0; ii < iters; ii++) {
            arr.shift();
        }
    });


    chan = new Chan<number>();
    await runner.runOnce(`put.  items: ${iters}`, {actualIters: iters}, async () => {
        for (let ii = 0; ii < iters; ii++) {
            await chan.put(ii);
        }
    });
    chan.close();

    chan = new Chan<number>();
    await runner.runOnce(`alternating put and get.  items: ${iters}`, {actualIters: iters}, async () => {
        for (let ii = 0; ii < iters; ii++) {
            await chan.put(ii);
            await chan.put(ii);
            await chan.get();
            await chan.get();
        }
    });
    chan.close();

    chan = new Chan<number>();
    await runner.runOnce(`put and get in series.  items: ${iters}`, {actualIters: iters}, async () => {
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
        await runner.runOnce(`put and get in parallel.  items: ${iters}; capacity: ${CAPACITY}`, {actualIters: iters}, async () => {
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
    await runner.runOnce(`put, seal, and forEach in series.  items: ${iters}`, {actualIters: iters}, async () => {
        for (let ii = 0; ii < iters; ii++) {
            await chan.put(ii);
        }
        chan.seal();
        await chan.forEach((item) => {});
    });
    chan.close();

    for (let CAPACITY of [0, 1, 2, 5, 100, null]) {
        chan = new Chan<number>(CAPACITY);
        await runner.runOnce(`put, seal, and forEach in parallel.  items: ${iters}; capacity: ${CAPACITY}`, {actualIters: iters}, async () => {
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

main();

