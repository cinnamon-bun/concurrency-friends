import 'jest';

import { Lock } from '../lock';
import { sleep } from '../util';

test('return value', async () => {
    let lock = new Lock<number>();
    let result = await lock.run(async (): Promise<number> => {
        return 123;
    });
    expect(result).toEqual(123);
});

test('error in sync function', async () => {
    let lock = new Lock<number>();
    try {
        await lock.run((): number => {
            throw new Error('oops');
        });
        expect(true).toBe(false);
    } catch (err) {
        expect('' + err).toBe('Error: oops');
    }
});

test('error in async function', async () => {
    let lock = new Lock<number>();
    try {
        await lock.run(async (): Promise<number> => {
            throw new Error('oops');
        });
        expect(true).toBe(false);
    } catch (err) {
        expect('' + err).toBe('Error: oops');
    }
});

test('error in async function with bypass', async () => {
    let lock = new Lock<number>();
    try {
        await lock.run(async (): Promise<number> => {
            throw new Error('oops');
        }, { bypass: true });
        expect(true).toBe(false);
    } catch (err) {
        expect('' + err).toBe('Error: oops');
    }
});

test('regular lock does not run instantly', async () => {
    let lock = new Lock<void>();
    let global = 1;
    lock.run(() => {
        global = 2;
    }, { bypass: false });
    expect(global).toBe(1);
    await sleep(1);
    expect(global).toBe(2);
});

test('bypass does not run instantly', async () => {
    let lock = new Lock<void>();
    let global = 1;
    lock.run(() => {
        global = 2;
    }, { bypass: true });
    expect(global).toBe(1);
    await sleep(1);
    expect(global).toBe(2);
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

    let lock = new Lock<void>();
    lock.run(myFn);
    lock.run(myFn);
    await lock.run(myFn);
    await lock.run(myFn);
    lock.run(myFn);
    lock.run(myFn);
    await lock.run(myFn);
});

test('bypass', async () => {
    let globalId: number;
    let myFn = async () => {
        expect(globalId).toBe(101);
        await sleep(60);
        expect(globalId).toBe(102);
    };

    let lock = new Lock<void>();
    globalId = 101;
    let proms: Promise<void>[] = [];
    proms.push(lock.run(myFn, { bypass: true }));
    proms.push(lock.run(myFn, { bypass: true }));
    proms.push(lock.run(myFn, { bypass: true }));
    await sleep(30);
    globalId = 102;
    await sleep(70);
    await Promise.all(proms);
});

test('should run in order - sync', async () => {
    let array: number[] = [];
    let lock = new Lock<any>();
    lock.run(() => array.push(0));
    lock.run(() => array.push(1));
    await lock.run(() => array.push(2));
    expect(array).toEqual([0, 1, 2]);
    await lock.run(() => array.push(3));
    lock.run(() => array.push(4));
    lock.run(() => array.push(5));
    await lock.run(() => array.push(6));
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
    let lock = new Lock<void>();
    lock.run(makePushFn(0, 20));
    lock.run(makePushFn(1, 8));
    await lock.run(makePushFn(2, 4));
    expect(array).toEqual([0, 1, 2]);
    await lock.run(makePushFn(3, 50));
    lock.run(makePushFn(4, 40));
    lock.run(makePushFn(5, 24));
    await lock.run(makePushFn(6, 5));
    expect(array).toEqual([0, 1, 2, 3, 4, 5, 6]);
});

test('priority lock but with regular lock', async () => {
    let array: number[] = [];
    let makePushFn = (n: number, d: number) => {
        return async () => {
            await sleep(d);
            array.push(n);
        };
    };
    let lock = new Lock<void>();
    lock.run(makePushFn(0, 50));
    lock.run(makePushFn(3, 50));
    lock.run(makePushFn(1, 50));
    await lock.run(makePushFn(2, 50));
    expect(array).toEqual([0, 3, 1, 2]);
    lock.run(makePushFn(0, 50));
    lock.run(makePushFn(3, 50));
    lock.run(makePushFn(1, 50));
    await lock.run(makePushFn(2, 50));
    expect(array).toEqual([0, 3, 1, 2, 0, 3, 1, 2]);
});

test('priority lock', async () => {
    let array: number[] = [];
    let makePushFn = (n: number, d: number) => {
        return async () => {
            await sleep(d);
            array.push(n);
        };
    };
    let lock = new Lock<void>();
    lock.run(makePushFn(0, 50), { priority: 0 });
    lock.run(makePushFn(3, 50), { priority: 3 });
    lock.run(makePushFn(1, 50), { priority: 1 });
    lock.run(makePushFn(2, 50), { priority: 2 });
    await lock.run(() => { }, { priority: 999 });  // wait until the queue is empty
    expect(array).toEqual([0, 1, 2, 3]);
    lock.run(makePushFn(0, 50), { priority: 0 });
    lock.run(makePushFn(3, 50), { priority: 3 });
    lock.run(makePushFn(1, 50), { priority: 1 });
    await lock.run( makePushFn(2, 50), { priority: 2 });
    await lock.run(() => { }, { priority: 999 });
    expect(array).toEqual([0, 1, 2, 3, 0, 1, 2, 3]);
});
