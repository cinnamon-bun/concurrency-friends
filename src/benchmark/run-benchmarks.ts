import { BenchmarkRunner } from './benchmark-runner';
import { benchmarkConveyor } from './conveyor.benchmark';
import { benchmarkChan } from './chan.benchmark';

let main = async () => {
    let runner = new BenchmarkRunner(console.log);
    await benchmarkConveyor(runner);
    await benchmarkChan(runner);
};

main();
