import { Conveyor, ConveyorHandlerFn } from '../conveyor';
import { makeDeferred } from '../deferred';
import { BenchmarkRunner } from './benchmark-runner';

let log = console.log;

export let benchmarkConveyor = async (runner: BenchmarkRunner) => {
    runner.setScenario('conveyor');
    let conveyor: Conveyor<number, number>;
    let double = (x: number) => x * 2;
    let asyncDouble = async (x: number) => x * 2;

    let iters = 100000;
    let itersString = Number(iters).toLocaleString('en-US');

    await runner.runOnce(`...for comparison: run sync function ${itersString} times.`, {actualIters: iters}, async () => {
        for (let ii = 0; ii < iters; ii++) {
            double(ii);
        }
    });

    await runner.runOnce(`...for comparison: run async function ${itersString} times.`, {actualIters: iters}, async () => {
        for (let ii = 0; ii < iters; ii++) {
            await asyncDouble(ii);
        }
    });

    type Scenario = [ConveyorHandlerFn<number, number>, string];
    let scenarios: Scenario[] = [[double, 'synchronous'], [asyncDouble, 'async']];
    for (let scenario of scenarios) {
        let [fn, scenarioName] = scenario;
        conveyor = new Conveyor(fn);
        await runner.runOnce(`conveyor: ${itersString} items, one at a time, ${scenarioName}.`, {actualIters: iters}, async () => {
            for (let ii = 0; ii < iters; ii++) {
                await conveyor.push(ii);
            }
        });
    }

    for (let scenario of scenarios) {
        let [fn, scenarioName] = scenario;
        conveyor = new Conveyor(fn);
        await runner.runOnce(`conveyor: ${itersString} items, sets of ten, ${scenarioName}.`, {actualIters: iters}, async () => {
            for (let ii = 0; ii < iters/10; ii++) {
                conveyor.push(ii);
                conveyor.push(ii);
                conveyor.push(ii);
                conveyor.push(ii);
                conveyor.push(ii);
                conveyor.push(ii);
                conveyor.push(ii);
                conveyor.push(ii);
                conveyor.push(ii);
                await conveyor.push(ii);
            }
        });
    }

    let d = makeDeferred<void>();
    conveyor = new Conveyor((x) => {
        if (x === iters - 1) {
            d.resolve();
        }
        return x * 2;
    });
    await runner.runOnce(`conveyor: ${itersString} items, dump in without awaiting, synchronous.`, {actualIters: iters}, async () => {
        for (let ii = 0; ii < iters; ii++) {
            conveyor.push(ii);
        }
        await d.promise;
    });

    d = makeDeferred<void>();
    conveyor = new Conveyor(async (x) => {
        if (x === iters - 1) {
            d.resolve();
        }
        return x * 2;
    });
    await runner.runOnce(`conveyor: ${itersString} items, dump in without awaiting, async.`, {actualIters: iters}, async () => {
        for (let ii = 0; ii < iters; ii++) {
            conveyor.push(ii);
        }
        await d.promise;
    });

    d = makeDeferred<void>();
    conveyor = new Conveyor<number, number>(async (x) => {
        if (x === iters - 1) {
            d.resolve();
        }
        return x * 2;
    });
    await runner.runOnce(`conveyor: ${itersString} items, dump in without awaiting, synchronous, priority.`, {actualIters: iters}, async () => {
        for (let ii = 0; ii < iters; ii++) {
            conveyor.push(ii, ii * 7.13123123 % 100);
        }
        await d.promise;
    });

    d = makeDeferred<void>();
    conveyor = new Conveyor<number, number>(async (x) => {
        if (x === iters - 1) {
            d.resolve();
        }
        return x * 2;
    });
    await runner.runOnce(`conveyor: ${itersString} items, dump in without awaiting, async, priority.`, {actualIters: iters}, async () => {
        for (let ii = 0; ii < iters; ii++) {
            conveyor.push(ii, ii * 7.13123123 % 100);
        }
        await d.promise;
    });


};
