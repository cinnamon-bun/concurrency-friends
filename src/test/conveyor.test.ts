import 'jest';

import { Conveyor } from '../conveyor';
import { sleep } from '../util';

test('return value', async () => {
    let double = async(x : number) : Promise<number> => {
        await sleep(Math.random() * 30);
        return x * 2;
    }
    let syncConveyor = new Conveyor<number, number>(double);
    for (let ii = 0; ii < 10; ii++) {
        let doubled = await syncConveyor.push(ii);
        expect(doubled).toEqual(ii * 2);
    }
});

test('basics with sync function', async () => {
    let ii = 0;
    let syncConveyor = new Conveyor<number, void>((x : number) : void => {
        expect(x).toBe(ii);
        ii += 1;
    });
    for (let ii = 0; ii < 5; ii++) {
        await syncConveyor.push(ii);
    }
});

test('only one async function running at once', async () => {
    let globalId = 0;
    let conv = new Conveyor<number, void>(async (x : number) : Promise<void> => {
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
    let thread1 = new Promise(async (resolve, reject) => {
        for (let ii = 0; ii < 5; ii++) {
            await conv.push(ii);
        }
        resolve();
    });
    let thread2 = new Promise(async (resolve, reject) => {
        for (let ii = 100; ii < 105; ii++) {
            await conv.push(ii);
        }
        resolve();
    });
    await Promise.all([thread1, thread2]);
});

test('exercise the queue', async () => {
    // a conveyor that stores everything into a long list
    let accum : number[] = [];
    let conv = new Conveyor<number, void>(async (x : number) : Promise<void> => {
        await sleep(10);
        accum.push(x);
        await sleep(10);
    });
    // start a bunch of pushes in parallel
    let numThreads = 10;
    let promises = [];
    let expectedAccum = [];
    for (let tt = 0; tt < numThreads; tt++) {
        promises.push(conv.push(tt));
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

test('priority queue', async () => {
    // a conveyor that stores everything into a long list
    let accum : number[] = [];
    let sortKeyFn = (n : number) => n;
    let conv = new Conveyor<number, void>(async (x : number) : Promise<void> => {
        await sleep(10);
        accum.push(x);
        await sleep(10);
    }, sortKeyFn);
    expect(conv.sortKeyFn).not.toBeNull();

    let input = [1, 7, 6, 9, 4, 2, 2, 3];
    let promises = [];
    for (let val of input) {
        promises.push(conv.push(val));
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


/*
let test = async () => {
    let syncConveyor = new Conveyor<number>((x : number | undefined) : void => {
        console.log('instant', x || 'idle');
    });
    let instantConveyor = new Conveyor<number>(async (x : number | undefined) : Promise<void> => {
        console.log('instant', x || 'idle');
    });
    let delayConveyor = new Conveyor<number>(async (x : number | undefined) : Promise<void> => {
        console.log('delay starting...', x || 'idle');
        await delay(500);
        console.log('...delay', x || 'idle');
    });

    console.log('-------------------------------------------------- DELAY');
    console.log('============= PUSHING 1 2 3');
    delayConveyor.push(1);
    delayConveyor.push(2);
    delayConveyor.push(3);
    console.log('=============/');
    setTimeout(() => {
        console.log('============= PUSHING 4 5 6');
        delayConveyor.push(4);
        delayConveyor.push(5);
        delayConveyor.push(6);
        console.log('=============/');
    }, 750);
    await delay(4000);

    console.log('-------------------------------------------------- INSTANT');
    console.log('============= PUSHING 1 2 3');
    instantConveyor.push(1);
    instantConveyor.push(2);
    instantConveyor.push(3);
    console.log('=============/');
    await delay(500);
    console.log('============= PUSHING 4 5 6');
    instantConveyor.push(4);
    instantConveyor.push(5);
    instantConveyor.push(6);
    console.log('=============/');

    await delay(500);

    console.log('-------------------------------------------------- SYNC');
    console.log('============= PUSHING 1 2 3');
    syncConveyor.push(1);
    syncConveyor.push(2);
    syncConveyor.push(3);
    console.log('=============/');
    await delay(500);
    console.log('============= PUSHING 4 5 6');
    syncConveyor.push(4);
    syncConveyor.push(5);
    syncConveyor.push(6);
    console.log('=============/');

    console.log('--------------------------------------------------/');
};

test();
*/