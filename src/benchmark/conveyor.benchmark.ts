import { Conveyor } from '../conveyor';
import { BenchmarkRunner } from './benchmark-runner';

export let benchmarkConveyor = async (runner: BenchmarkRunner) => {
    runner.setScenario('conveyor');
    let conveyor: Conveyor<number, number>;
    let double = (x: number) => x * 2;
    let asyncDouble = async (x: number) => x * 2;

    let iters = 150000;
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
};
