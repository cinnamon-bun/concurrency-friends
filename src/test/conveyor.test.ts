import 'jest';

import { Conveyor } from '../conveyor';
import { sleep } from '../util';

test('return value, sync', async () => {
    let double = (x: number): number => {
        return x * 2;
    };
    let conveyor = new Conveyor<number, number>(double);
    for (let ii = 0; ii < 10; ii++) {
        let doubled = await conveyor.push(ii);
        expect(doubled).toEqual(ii * 2);
    }
});

test('return value, async', async () => {
    let double = async (x: number): Promise<number> => {
        await sleep(Math.random() * 30);
        return x * 2;
    };
    let conveyor = new Conveyor<number, number>(double);
    for (let ii = 0; ii < 10; ii++) {
        let doubled = await conveyor.push(ii);
        expect(doubled).toEqual(ii * 2);
    }
});

test('basics with sync function', async () => {
    let ii = 0;
    let syncConveyor = new Conveyor<number, void>((x: number): void => {
        expect(x).toBe(ii);
        ii += 1;
    });
    for (let ii = 0; ii < 5; ii++) {
        await syncConveyor.push(ii);
    }
});

test('only one async function running at once', async () => {
    let globalId = 0;
    let conveyor = new Conveyor<number, void>(async (x: number): Promise<void> => {
        // this will pass if only one copy of it runs at once.
        let thisId = Math.floor(Math.random() * 10000);
        globalId = thisId;
        await sleep(Math.random() * 10);
        expect(globalId).toEqual(thisId);
        await sleep(Math.random() * 10);
        expect(globalId).toEqual(thisId);
        await sleep(Math.random() * 10);
        expect(globalId).toEqual(thisId);
        await sleep(Math.random() * 10);
        expect(globalId).toEqual(thisId);
    });
    let thread1 = new Promise<void>(async (resolve, reject) => {
        for (let ii = 0; ii < 5; ii++) {
            await conveyor.push(ii);
        }
        resolve();
    });
    let thread2 = new Promise<void>(async (resolve, reject) => {
        for (let ii = 100; ii < 105; ii++) {
            await conveyor.push(ii);
        }
        resolve();
    });
    await Promise.all([thread1, thread2]);
});

test('exercise the queue', async () => {
    // a conveyor that stores everything into a long list
    let accum: number[] = [];
    let conveyor = new Conveyor<number, void>(async (x: number): Promise<void> => {
        await sleep(10);
        accum.push(x);
        await sleep(10);
    });
    // start a bunch of pushes in parallel
    let numThreads = 10;
    let promises = [];
    let expectedAccum = [];
    for (let tt = 0; tt < numThreads; tt++) {
        promises.push(conveyor.push(tt));
        expectedAccum.push(tt);
    }
    // confirm that none of the items arrived yet
    expect(accum.length).toBe(0);
    // wait for them all to finish
    await Promise.all(promises);
    // confirm that the items all arrived in the right order
    expect(accum.length).toBe(numThreads);
    expect(accum).toEqual(expectedAccum);
});

test('priority queue with numbers', async () => {
    // a conveyor that stores everything into a long list
    let accum: number[] = [];
    let conveyor = new Conveyor<number, void>(async (x: number): Promise<void> => {
        await sleep(10);
        accum.push(x);
        await sleep(10);
    });

    let input = [1, 7, 6, 9, 4, 2, 2, 3];
    let promises = [];
    for (let val of input) {
        promises.push(conveyor.push(val, val));
    }
    // confirm that none of the items arrived yet
    expect(accum.length).toBe(0);
    // wait for them all to finish
    await Promise.all(promises);
    // confirm that the items all arrived in the right order
    input.sort();
    expect(accum.length).toBe(input.length);
    expect(accum).toEqual(input);
});

test('priority queue with strings', async () => {
    // a conveyor that stores everything into a long list
    let accum: string[] = [];
    let conveyor = new Conveyor<string, void>(async (x: string): Promise<void> => {
        await sleep(10);
        accum.push(x);
        await sleep(10);
    });

    let input = ['a', 'r', 'e', 'f', 'aaa', 'w'];
    let promises = [];
    for (let val of input) {
        promises.push(conveyor.push(val, val));
    }
    // confirm that none of the items arrived yet
    expect(accum.length).toBe(0);
    // wait for them all to finish
    await Promise.all(promises);
    // confirm that the items all arrived in the right order
    input.sort();
    expect(accum.length).toBe(input.length);
    expect(accum).toEqual(input);
});

// TODO: mixture of numbers AND strings as priorities,
// combined with items without explicit priorities

test('error handling with sync handler', async () => {
    let doubleSync = (x: number): number => {
        if (x === 4) { throw new Error('x is four'); }
        return x * 2;
    };
    let syncConveyor = new Conveyor<number, number>(doubleSync);
    // preload with some things that won't cause errors
    for (let ii = 100; ii < 110; ii++) {
        syncConveyor.push(ii);
    }
    for (let ii = 0; ii < 10; ii++) {
        // insert more items
        // only this one will cause an error...
        if (ii === 4) {
            try {
                await syncConveyor.push(ii);
                expect(true).toBe(false);
            } catch (e) {
                expect('' + e).toMatch('Error: x is four');
            }
        // the rest will succeed, even after the error
        } else {
            let doubled = await syncConveyor.push(ii);
            expect(doubled).toEqual(ii * 2);
        }
    }
});

test('error handling with async handler', async () => {
    let doubleAsync = async (x: number): Promise<number> => {
        await sleep(Math.random() * 30);
        if (x === 4) { throw new Error('x is four'); }
        return x * 2;
    };
    let asyncConveyor = new Conveyor<number, number>(doubleAsync);
    // preload with some things that won't cause errors
    for (let ii = 100; ii < 110; ii++) {
        asyncConveyor.push(ii);
    }
    for (let ii = 0; ii < 10; ii++) {
        if (ii === 4) {
            try {
                await asyncConveyor.push(ii);
                expect(true).toBe(false);
            } catch (e) {
                expect('' + e).toMatch('Error: x is four');
            }
        } else {
            let doubled = await asyncConveyor.push(ii);
            expect(doubled).toEqual(ii * 2);
        }
    }
});
