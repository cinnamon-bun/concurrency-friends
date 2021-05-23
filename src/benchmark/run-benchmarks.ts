import { BenchmarkRunner } from './benchmark-runner';
import { benchmarkChan } from './chan.benchmark';
import { benchmarkConveyor } from './conveyor.benchmark';
import { benchmarkLock } from './lock.benchmark';

let main = async () => {
    let runner = new BenchmarkRunner(console.log);
    await benchmarkChan(runner);
    await benchmarkConveyor(runner);
    await benchmarkLock(runner);
};

main();
