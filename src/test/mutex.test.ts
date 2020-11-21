import 'jest';

import { Mutex, PriorityMutex } from '../mutex';
import { sleep } from '../util';

test('return value', async () => {
    let mutex = new Mutex<number>();
    let result = await mutex.run(async (): Promise<number> => {
        return 123;
    });
    expect(result).toEqual(123);
});

test('error in sync function', async () => {
    let mutex = new Mutex<number>();
    try {
        await mutex.run((): number => {
            throw new Error('oops');
        });
        expect(true).toBe(false);
    } catch (err) {
        expect('' + err).toBe('Error: oops');
    }
});

test('error in async function', async () => {
    let mutex = new Mutex<number>();
    try {
        await mutex.run(async (): Promise<number> => {
            throw new Error('oops');
        });
        expect(true).toBe(false);
    } catch (err) {
        expect('' + err).toBe('Error: oops');
    }
});

test('basics', async () => {
    let globalId: number;
    let myFn = async () => {
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
    };

    let mutex = new Mutex<void>();
    mutex.run(myFn);
    mutex.run(myFn);
    await mutex.run(myFn);
    await mutex.run(myFn);
    mutex.run(myFn);
    mutex.run(myFn);
    await mutex.run(myFn);
});

test('should run in order - sync', async () => {
    let array: number[] = [];
    let mutex = new Mutex<any>();
    mutex.run(() => array.push(0));
    mutex.run(() => array.push(1));
    await mutex.run(() => array.push(2));
    expect(array).toEqual([0, 1, 2]);
    await mutex.run(() => array.push(3));
    mutex.run(() => array.push(4));
    mutex.run(() => array.push(5));
    await mutex.run(() => array.push(6));
    expect(array).toEqual([0, 1, 2, 3, 4, 5, 6]);
});

test('should run in order - async', async () => {
    let array: number[] = [];
    let makePushFn = (n: number, d: number) => {
        return async () => {
            await sleep(d);
            array.push(n);
        };
    };
    let mutex = new Mutex<void>();
    mutex.run(makePushFn(0, 20));
    mutex.run(makePushFn(1, 8));
    await mutex.run(makePushFn(2, 4));
    expect(array).toEqual([0, 1, 2]);
    await mutex.run(makePushFn(3, 50));
    mutex.run(makePushFn(4, 40));
    mutex.run(makePushFn(5, 24));
    await mutex.run(makePushFn(6, 5));
    expect(array).toEqual([0, 1, 2, 3, 4, 5, 6]);
});

test('priority mutex but with regular mutex', async () => {
    let array: number[] = [];
    let makePushFn = (n: number, d: number) => {
        return async () => {
            await sleep(d);
            array.push(n);
        };
    };
    let mutex = new Mutex<void>();
    mutex.run(makePushFn(0, 50));
    mutex.run(makePushFn(3, 50));
    mutex.run(makePushFn(1, 50));
    await mutex.run(makePushFn(2, 50));
    expect(array).toEqual([0, 3, 1, 2]);
    mutex.run(makePushFn(0, 50));
    mutex.run(makePushFn(3, 50));
    mutex.run(makePushFn(1, 50));
    await mutex.run(makePushFn(2, 50));
    expect(array).toEqual([0, 3, 1, 2, 0, 3, 1, 2]);
});

test('priority mutex', async () => {
    let array: number[] = [];
    let makePushFn = (n: number, d: number) => {
        return async () => {
            await sleep(d);
            array.push(n);
        };
    };
    let mutex = new PriorityMutex<void>();
    mutex.run(0, makePushFn(0, 50));
    mutex.run(3, makePushFn(3, 50));
    mutex.run(1, makePushFn(1, 50));
    mutex.run(2, makePushFn(2, 50));
    await mutex.run(999, () => { });  // wait until the queue is empty
    expect(array).toEqual([0, 1, 2, 3]);
    mutex.run(0, makePushFn(0, 50));
    mutex.run(3, makePushFn(3, 50));
    mutex.run(1, makePushFn(1, 50));
    await mutex.run(2, makePushFn(2, 50));
    await mutex.run(999, () => { });
    expect(array).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
});
