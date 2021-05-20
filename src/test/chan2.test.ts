import 'jest';

import { Chan2, Channel2IsClosedError, Channel2IsSealedError, Channel2TimeoutError } from '../chan2';
import { sleep } from '../util';

//process.on('unhandledRejection', (reason : any, p : any) => {
//    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
//});

test('basic getter methods (isClosed, etc)', async () => {
    let chanInf = new Chan2<number>();
    expect(chanInf.isClosed).toBe(false);
    expect(chanInf.isSealed).toBe(false);
    expect(chanInf.capacity).toBe(null);
    expect(chanInf.itemsInQueue).toBe(0);
    expect(chanInf.itemsInQueueAndWaitingPuts).toBe(0);
    expect(chanInf.numWaitingGets).toBe(0);
    expect(chanInf.isIdle).toBe(true);
    expect(chanInf.canImmediatelyPut).toBe(true);
    expect(chanInf.canImmediatelyGet).toBe(false);
    await chanInf.put(7);
    await chanInf.put(8);
    expect(chanInf.isClosed).toBe(false);
    expect(chanInf.isSealed).toBe(false);
    expect(chanInf.capacity).toBe(null);
    expect(chanInf.itemsInQueue).toBe(2);
    expect(chanInf.itemsInQueueAndWaitingPuts).toBe(2);
    expect(chanInf.numWaitingGets).toBe(0);
    expect(chanInf.isIdle).toBe(false);
    expect(chanInf.canImmediatelyPut).toBe(true);
    expect(chanInf.canImmediatelyGet).toBe(true);

    let chan1 = new Chan2<number>(1);
    expect(chan1.isClosed).toBe(false);
    expect(chan1.isSealed).toBe(false);
    expect(chan1.capacity).toBe(1);
    expect(chan1.itemsInQueue).toBe(0);
    expect(chan1.itemsInQueueAndWaitingPuts).toBe(0);
    expect(chan1.numWaitingGets).toBe(0);
    expect(chan1.isIdle).toBe(true);
    expect(chan1.canImmediatelyPut).toBe(true);
    expect(chan1.canImmediatelyGet).toBe(false);
    await chan1.put(7);
    expect(chan1.isClosed).toBe(false);
    expect(chan1.isSealed).toBe(false);
    expect(chan1.capacity).toBe(1);
    expect(chan1.itemsInQueue).toBe(1);
    expect(chan1.itemsInQueueAndWaitingPuts).toBe(1);
    expect(chan1.numWaitingGets).toBe(0);
    expect(chan1.isIdle).toBe(false);
    expect(chan1.canImmediatelyPut).toBe(false);
    expect(chan1.canImmediatelyGet).toBe(true);

    let chan0 = new Chan2<number>(0);
    expect(chan0.isClosed).toBe(false);
    expect(chan0.isSealed).toBe(false);
    expect(chan0.capacity).toBe(0);
    expect(chan0.itemsInQueue).toBe(0);
    expect(chan0.itemsInQueueAndWaitingPuts).toBe(0);
    expect(chan0.numWaitingGets).toBe(0);
    expect(chan0.isIdle).toBe(true);
    expect(chan0.canImmediatelyPut).toBe(false);
    expect(chan0.canImmediatelyGet).toBe(false);
});

describe('capacity = 0, blocked gets', () => {
    test('capacity = 0, blocked get with timeout:0 that expires immediately', async () => {
        let chan0 = new Chan2<number>(0);

        expect(chan0.isIdle).toBe(true);
        expect(chan0.numWaitingGets).toBe(0);
        expect(chan0.canImmediatelyPut).toBe(false);
        expect(chan0.canImmediatelyGet).toBe(false);

        let waitingGet = chan0.get({ timeout: 0 });

        expect(chan0.isIdle).toBe(true);
        expect(chan0.numWaitingGets).toBe(0);
        expect(chan0.canImmediatelyPut).toBe(false);
        expect(chan0.canImmediatelyGet).toBe(false);

        // wait for timeout
        try {
            await waitingGet;
            expect('should have thrown an error').toBe(true);
        } catch (err) {
            expect(err instanceof Channel2TimeoutError).toBe(true);
        }

        expect(chan0.isIdle).toBe(true);
        expect(chan0.numWaitingGets).toBe(0);
        expect(chan0.canImmediatelyPut).toBe(false);
        expect(chan0.canImmediatelyGet).toBe(false);
    });

    test('capacity = 0, blocked get with timeout:50 that expires', async () => {
        let chan0 = new Chan2<number>(0);

        expect(chan0.isIdle).toBe(true);
        expect(chan0.numWaitingGets).toBe(0);
        expect(chan0.canImmediatelyPut).toBe(false);
        expect(chan0.canImmediatelyGet).toBe(false);

        let waitingGet = chan0.get({ timeout: 50 });

        expect(chan0.isIdle).toBe(false);
        expect(chan0.numWaitingGets).toBe(1);
        expect(chan0.canImmediatelyPut).toBe(true);  // get is waiting
        expect(chan0.canImmediatelyGet).toBe(false);

        // wait for timeout
        try {
            await waitingGet;
            expect('should have thrown an error').toBe(true);
        } catch (err) {
            expect(err instanceof Channel2TimeoutError).toBe(true);
        }

        expect(chan0.isIdle).toBe(true);
        expect(chan0.numWaitingGets).toBe(0);
        expect(chan0.canImmediatelyPut).toBe(false);
        expect(chan0.canImmediatelyGet).toBe(false);
    });

    test('capacity = 0, blocked get with timeout:50, then resolved before it expires', async () => {
        let chan0 = new Chan2<number>(0);

        expect(chan0.isIdle).toBe(true);
        expect(chan0.numWaitingGets).toBe(0);
        expect(chan0.canImmediatelyPut).toBe(false);
        expect(chan0.canImmediatelyGet).toBe(false);

        // start a waiting get
        let waitingGet = chan0.get({ timeout: 50 });

        expect(chan0.isIdle).toBe(false);
        expect(chan0.numWaitingGets).toBe(1);
        expect(chan0.canImmediatelyPut).toBe(true);  // get is waiting
        expect(chan0.canImmediatelyGet).toBe(false);

        await sleep(20);

        // put something to resolve the waiting get
        await chan0.put(7);

        // get it
        let item = await waitingGet;
        expect(item).toBe(7);

        expect(chan0.isIdle).toBe(true);
        expect(chan0.numWaitingGets).toBe(0);
        expect(chan0.canImmediatelyPut).toBe(false);
        expect(chan0.canImmediatelyGet).toBe(false);
    });

    test('capacity = 0, blocked get with timeout:null, then resolved', async () => {
        let chan0 = new Chan2<number>(0);

        expect(chan0.isIdle).toBe(true);
        expect(chan0.numWaitingGets).toBe(0);
        expect(chan0.canImmediatelyPut).toBe(false);
        expect(chan0.canImmediatelyGet).toBe(false);

        // start a waiting get
        let waitingGet = chan0.get({ timeout: null });

        expect(chan0.isIdle).toBe(false);
        expect(chan0.numWaitingGets).toBe(1);
        expect(chan0.canImmediatelyPut).toBe(true);  // get is waiting
        expect(chan0.canImmediatelyGet).toBe(false);

        await sleep(20);

        // put something to resolve the waiting get
        await chan0.put(7);

        // get it
        let item = await waitingGet;
        expect(item).toBe(7);

        expect(chan0.isIdle).toBe(true);
        expect(chan0.numWaitingGets).toBe(0);
        expect(chan0.canImmediatelyPut).toBe(false);
        expect(chan0.canImmediatelyGet).toBe(false);
    });

    test('capacity = 0, blocked get with no timeout set at all, then resolved', async () => {
        let chan0 = new Chan2<number>(0);

        expect(chan0.isIdle).toBe(true);
        expect(chan0.numWaitingGets).toBe(0);
        expect(chan0.canImmediatelyPut).toBe(false);
        expect(chan0.canImmediatelyGet).toBe(false);

        // start a waiting get
        let waitingGet = chan0.get();

        expect(chan0.isIdle).toBe(false);
        expect(chan0.numWaitingGets).toBe(1);
        expect(chan0.canImmediatelyPut).toBe(true);  // get is waiting
        expect(chan0.canImmediatelyGet).toBe(false);

        await sleep(20);

        // put something to resolve the waiting get
        await chan0.put(7);

        // get it
        let item = await waitingGet;
        expect(item).toBe(7);

        expect(chan0.isIdle).toBe(true);
        expect(chan0.numWaitingGets).toBe(0);
        expect(chan0.canImmediatelyPut).toBe(false);
        expect(chan0.canImmediatelyGet).toBe(false);
    });
});


/*
test('canGet and canPut with blocked write, capacity=0', async () => {
    let chan = new Chan2<number>(0);
    expect(chan.canPutWithoutBlocking).toBe(false);
    expect(chan.canGetWithoutBlocking).toBe(false);
    let p = chan.put(1, 50)
        .then(() => expect(true).toBe(false))
        .catch(e => expect('' + e).toBe('ChannelTimeoutError: put() timed out'));
    expect(chan.canPutWithoutBlocking).toBe(false);
    expect(chan.canGetWithoutBlocking).toBe(true);
    await p;
});
*/

describe('first in, first out', () => {
    test('first in, first out, put all then get all', async () => {
        let chanInf = new Chan2<number>();
        await chanInf.put(1);
        await chanInf.put(2);
        await chanInf.put(3);
        expect(await chanInf.get()).toBe(1);
        expect(await chanInf.get()).toBe(2);
        expect(await chanInf.get()).toBe(3);
    });

    test('first in, first out, intermixed', async () => {
        let chan = new Chan2<number>();
        await chan.put(1);
        await chan.put(2);
        expect(await chan.get()).toBe(1);
        await chan.put(3);
        expect(await chan.get()).toBe(2);
        expect(await chan.get()).toBe(3);
    });
});

describe('timeout on get', () => {
    for (let TIMEOUT of [0, 10]) {
        test(`successful get, then expired get.  timeout=${TIMEOUT}, capacity=infinite`, async () => {
            let chan = new Chan2<number>();
            await chan.put(1);
            expect(chan.isIdle).toBeFalsy();
            expect(await chan.get()).toBe(1);
            expect(chan.isIdle).toBeTruthy();

            try {
                await chan.get({ timeout: TIMEOUT })
                expect('should have thrown an error').toBe(true);
            } catch (err) {
                expect(err instanceof Channel2TimeoutError).toBeTruthy();
            }
            expect(chan.isIdle).toBeTruthy();
        });
    }

    for (let TIMEOUT of [0, 10]) {
        test(`expired get, then successful get.  timeout=${TIMEOUT}, capacity=infinite`, async () => {
            let chan = new Chan2<number>();
            try {
                await chan.get({ timeout: TIMEOUT })
                expect('should have thrown an error').toBe(true);
            } catch (err) {
                expect(err instanceof Channel2TimeoutError).toBeTruthy();
            }
            expect(chan.isIdle).toBeTruthy();
            await chan.put(1);
            await chan.put(2);
            expect(chan.isIdle).toBeFalsy();
            expect(await chan.get()).toBe(1);
            expect(await chan.get()).toBe(2);
            expect(chan.isIdle).toBeTruthy();
        });
    }
});


describe('timeout on put', () => {
    for (let TIMEOUT of [0, 10]) {
        for (let CAPACITY of [0, 1, 5]) {
            test(`put to fill queue, then put again with timeout.  timeout=${TIMEOUT}, capacity=${CAPACITY}`, async () => {
                let chan = new Chan2<number>(CAPACITY);
                // fill the queue
                for (let ii = 0; ii < CAPACITY; ii++) {
                    await chan.put(ii);
                }
                // write timeout
                try {
                    await chan.put(999, { timeout: TIMEOUT })
                    expect('should have thrown an error').toBe(true);
                } catch (err) {
                    expect(err instanceof Channel2TimeoutError).toBeTruthy();
                }
            });
        }
    }
});

describe('timeout on put, then timeout on get', () => {
    for (let TIMEOUT of [0, 10]) {
        for (let CAPACITY of [0, 1, 5]) {
            test(`fill queue, put timeout, drain queue, read timeout.  timeout=${TIMEOUT}, capacity=${CAPACITY}`, async () => {
                let chan = new Chan2<number>(CAPACITY);
                // fill the queue
                for (let ii = 0; ii < CAPACITY; ii++) {
                    await chan.put(ii);
                }
                // write timeout
                try {
                    await chan.put(999, { timeout: TIMEOUT })
                    expect('should have thrown an error').toBe(true);
                } catch (err) {
                    expect(err instanceof Channel2TimeoutError).toBeTruthy();
                }
                // drain the queue
                for (let ii = 0; ii < CAPACITY; ii++) {
                    expect(await chan.get()).toBe(ii);
                }
                // get one more -- should not get anything
                try {
                    await chan.get({ timeout: TIMEOUT })
                    expect('should have thrown an error').toBe(true);
                } catch (err) {
                    expect(err instanceof Channel2TimeoutError).toBeTruthy();
                }
            });
        }
    }
});

describe('capacity zero', () => {
    test(`capacity=0`, async () => {
        let chan0 = new Chan2<number>(0);
        expect(chan0.canImmediatelyPut).toBe(false);
        expect(chan0.canImmediatelyGet).toBe(false);
        expect(chan0.isIdle).toBe(true);

        let waitingPut = chan0.put(1, { timeout: 50 });
        expect(chan0.canImmediatelyPut).toBe(false);
        expect(chan0.canImmediatelyGet).toBe(true);

        let item1 = await chan0.get();
        expect(chan0.canImmediatelyPut).toBe(false);
        expect(chan0.canImmediatelyGet).toBe(false);
        expect(chan0.isIdle).toBe(true);

        let waitingGet = chan0.get({ timeout: 50 });
        expect(chan0.canImmediatelyPut).toBe(true);
        expect(chan0.canImmediatelyGet).toBe(false);

        await chan0.put(7);
        expect(chan0.canImmediatelyPut).toBe(false);
        expect(chan0.canImmediatelyGet).toBe(false);
        expect(chan0.isIdle).toBe(true);
    });
});

describe('two threads', () => {
    for (let CAPACITY of [0, 1, 2, 3, 4, 1000, undefined]) {
        test(`two threads.  capacity=${CAPACITY}`, async () => {
            let chan = new Chan2<number>(CAPACITY);
            let thread1 = new Promise<void>(async (resolve, reject) => {
                await chan.put(1);
                await chan.put(2);
                await sleep(60);
                await chan.put(3);
                await chan.put(4);
                resolve();
            });
            let thread2 = new Promise<void>(async (resolve, reject) => {
                await sleep(40);
                expect(await chan.get()).toBe(1);
                expect(await chan.get()).toBe(2);
                expect(await chan.get()).toBe(3);
                expect(await chan.get()).toBe(4);
                resolve();
            });
            await Promise.all([thread1, thread2]);
        });
    }

    for (let CAPACITY of [0, 1, 2, 4, 1000, undefined]) {
        test(`two threads timing fuzz test.  capacity=${CAPACITY}`, async () => {
            let n = 30;
            let chan = new Chan2<number>(CAPACITY);
            // put N items with random timing
            let thread1 = new Promise<void>(async (resolve, reject) => {
                for (let ii = 0; ii < n; ii++) {
                    if (Math.random() < 0.5) {
                        await sleep(Math.random() * 8);
                    }
                    await chan.put(ii);
                }
                resolve();
            });
            // get them, with random timing
            // expect them in the same order and the same number
            let thread2 = new Promise<void>(async (resolve, reject) => {
                for (let ii = 0; ii < n; ii++) {
                    if (Math.random() < 0.5) {
                        await sleep(Math.random() * 8);
                    }
                    expect(await chan.get()).toBe(ii);
                }
                // pull one more -- should not get anything
                try {
                    await chan.get({ timeout: 0 })
                    expect('should have thrown an error').toBe(true);
                } catch (err) {
                    expect(err instanceof Channel2TimeoutError).toBeTruthy();
                }
                resolve();
            });
            await Promise.all([thread1, thread2]);
        });
    }
});

describe('seal', () => {
    test(`seal when idle`, async () => {
        let chanInf = new Chan2<number>();

        expect(chanInf.isSealed).toBe(false);
        expect(chanInf.isClosed).toBe(false);
        expect(chanInf.isIdle).toBe(true);
        expect(chanInf.canImmediatelyPut).toBe(true);
        expect(chanInf.canImmediatelyGet).toBe(false);

        // seal it when idle; this will also close it right away
        chanInf.seal();
        expect(chanInf.isSealed).toBe(true);
        expect(chanInf.isClosed).toBe(true);
        expect(chanInf.isIdle).toBe(true);
        expect(chanInf.canImmediatelyPut).toBe(false);
        expect(chanInf.canImmediatelyGet).toBe(false);

        // can't put another one
        try {
            await chanInf.put(999, { timeout: 20 })
            expect('should have thrown an error').toBe(true);
        } catch (err) {
            // Closed error wins over Sealed error, if it's both sealed and closed
            expect(err instanceof Channel2IsSealedError).toBeTruthy();
        }
        
        // can't get another one
        try {
            await chanInf.get({ timeout: 20 })
            expect('should have thrown an error').toBe(true);
        } catch (err) {
            expect(err instanceof Channel2IsSealedError).toBeTruthy();
        }
    });

    test(`close then seal`, async () => {
        let chanInf = new Chan2<number>();

        expect(chanInf.isSealed).toBe(false);
        expect(chanInf.isClosed).toBe(false);
        expect(chanInf.isIdle).toBe(true);

        chanInf.close();
        expect(chanInf.isSealed).toBe(false);
        expect(chanInf.isClosed).toBe(true);
        expect(chanInf.isIdle).toBe(true);

        chanInf.close();
        expect(chanInf.isSealed).toBe(false);
        expect(chanInf.isClosed).toBe(true);
        expect(chanInf.isIdle).toBe(true);

        chanInf.seal();
        expect(chanInf.isSealed).toBe(true);
        expect(chanInf.isClosed).toBe(true);
        expect(chanInf.isIdle).toBe(true);

        chanInf.seal();
        expect(chanInf.isSealed).toBe(true);
        expect(chanInf.isClosed).toBe(true);
        expect(chanInf.isIdle).toBe(true);
    });

    test(`seal then close`, async () => {
        let chanInf = new Chan2<number>();

        // load it up
        await chanInf.put(1);
        await chanInf.put(2);

        // seal it
        chanInf.seal();
        expect(chanInf.isSealed).toBe(true);
        expect(chanInf.isClosed).toBe(false);
        expect(chanInf.isIdle).toBe(false);

        chanInf.close();
        expect(chanInf.isSealed).toBe(true);
        expect(chanInf.isClosed).toBe(true);
        expect(chanInf.isIdle).toBe(true);
    });

    test(`seal when queue has some items`, async () => {
        let chanInf = new Chan2<number>();

        // load it up
        await chanInf.put(1);
        await chanInf.put(2);

        // seal it
        chanInf.seal();
        expect(chanInf.isSealed).toBe(true);
        expect(chanInf.isClosed).toBe(false);
        expect(chanInf.isIdle).toBe(false);

        // can't put another one
        try {
            await chanInf.put(999, { timeout: 20 })
            expect('should have thrown an error').toBe(true);
        } catch (err) {
            expect(err instanceof Channel2IsSealedError).toBeTruthy();
        }

        // drain it...
        expect(await chanInf.get()).toBe(1);
        expect(chanInf.isSealed).toBe(true);
        expect(chanInf.isClosed).toBe(false);
        expect(chanInf.isIdle).toBe(false);

        // get the last one, now it will auto-close because it's empty and sealed
        expect(await chanInf.get()).toBe(2);
        expect(chanInf.isSealed).toBe(true);
        expect(chanInf.isClosed).toBe(true);
        expect(chanInf.isIdle).toBe(true);
        
        // can't get another one
        try {
            await chanInf.get({ timeout: 20 })
            expect('should have thrown an error').toBe(true);
        } catch (err) {
            expect(err instanceof Channel2IsSealedError).toBeTruthy();
        }
    });

    test(`seal with waiting puts`, async () => {
        let chanInf = new Chan2<number>(1);

        // load it up
        await chanInf.put(1);
        let waitingPut = chanInf.put(2, { timeout: 30 });

        expect(chanInf.itemsInQueue).toBe(1);
        expect(chanInf.itemsInQueueAndWaitingPuts).toBe(2);

        // seal it
        chanInf.seal();
        expect(chanInf.isSealed).toBe(true);
        expect(chanInf.isClosed).toBe(false);
        expect(chanInf.isIdle).toBe(false);
        expect(chanInf.itemsInQueue).toBe(1);
        expect(chanInf.itemsInQueueAndWaitingPuts).toBe(1);  // waiting put was cancelled

        try {
            await waitingPut;
            expect('should have thrown an error').toBe(true);
        } catch (err) {
            expect(err instanceof Channel2IsSealedError).toBeTruthy();
        }
    });

    test(`seal with waiting gets`, async () => {
        let chanInf = new Chan2<number>();

        let waitingGet = chanInf.get({ timeout: 30 });
        expect(chanInf.isIdle).toBe(false);

        // seal it
        chanInf.seal();
        expect(chanInf.isSealed).toBe(true);
        expect(chanInf.isClosed).toBe(true);
        expect(chanInf.isIdle).toBe(true);

        try {
            await waitingGet;
            expect('should have thrown an error').toBe(true);
        } catch (err) {
            expect(err instanceof Channel2IsSealedError).toBeTruthy();
        }
    });
});

describe('seal with two threads', () => {
    for (let CAPACITY of [0, 1, 2, 3, 4, 1000, undefined]) {
        test(`two threads.  capacity=${CAPACITY}`, async () => {
            let chan = new Chan2<number>(CAPACITY);
            let thread1 = new Promise<void>(async (resolve, reject) => {
                await chan.put(1);
                await chan.put(2);
                await sleep(60);
                await chan.put(3);
                await chan.put(4);
                // seal, then expect the next put() to fail,
                // either because it's sealed or because it's closed
                // depending on if the other thread has caught up or not.
                chan.seal();
                try {
                    await chan.put(999);
                    expect('should have thrown an error').toBe(true);
                } catch (err) {
                    expect(err instanceof Channel2IsSealedError).toBeTruthy();
                }
                resolve();
            });
            let thread2 = new Promise<void>(async (resolve, reject) => {
                await sleep(40);
                expect(await chan.get()).toBe(1);
                expect(await chan.get()).toBe(2);
                expect(await chan.get()).toBe(3);
                expect(await chan.get()).toBe(4);
                if (CAPACITY !== 0) {
                    // it should be sealed and empty now, so it should have been closed...
                    // unless capacity is zero, in which case this code is running
                    // before the other thread gets a chance to run seal()
                    expect(chan.itemsInQueue).toBe(0);
                    expect(chan.isIdle).toBe(true);
                    expect(chan.isSealed).toBe(true);
                    expect(chan.isClosed).toBe(true);
                }
                // one more get() should guarantee that it's sealed and closed now
                try {
                    await chan.get({ timeout: 100 });
                    expect('should have thrown an error').toBe(true);
                } catch (err) {
                    expect(err instanceof Channel2IsSealedError).toBe(true);
                }
                // it should definitely be sealed and empty now, so it should have been closed
                expect(chan.itemsInQueue).toBe(0);
                expect(chan.isIdle).toBe(true);
                expect(chan.isSealed).toBe(true);
                expect(chan.isClosed).toBe(true);
                resolve();
            });
            await Promise.all([thread1, thread2]);
        });
    }
});

    // TODO: close it when there are waiting gets
    // TODO: close it when there are waiting puts
    // TODO: close it when there are items in queue

describe('close', () => {
    test(`close when idle`, async () => {
        let chanInf = new Chan2<number>();

        expect(chanInf.isSealed).toBe(false);
        expect(chanInf.isClosed).toBe(false);
        expect(chanInf.isIdle).toBe(true);
        expect(chanInf.canImmediatelyPut).toBe(true);
        expect(chanInf.canImmediatelyGet).toBe(false);

        // close it when idle
        chanInf.close();
        expect(chanInf.isSealed).toBe(false);
        expect(chanInf.isClosed).toBe(true);
        expect(chanInf.isIdle).toBe(true);
        expect(chanInf.canImmediatelyPut).toBe(false);
        expect(chanInf.canImmediatelyGet).toBe(false);

        // can't put another one
        try {
            await chanInf.put(999, { timeout: 20 })
            expect('should have thrown an error').toBe(true);
        } catch (err) {
            // Closed error wins over Sealed error, if it's both sealed and closed
            expect(err instanceof Channel2IsClosedError).toBeTruthy();
        }
        
        // can't get another one
        try {
            await chanInf.get({ timeout: 20 })
            expect('should have thrown an error').toBe(true);
        } catch (err) {
            expect(err instanceof Channel2IsClosedError).toBeTruthy();
        }
    });

    test(`close when queue has some items`, async () => {
        let chanInf = new Chan2<number>();

        // load it up
        await chanInf.put(1);
        await chanInf.put(2);
        expect(chanInf.itemsInQueue).toBe(2);

        // close it
        chanInf.close();
        expect(chanInf.isSealed).toBe(false);
        expect(chanInf.isClosed).toBe(true);
        expect(chanInf.isIdle).toBe(true);
        expect(chanInf.itemsInQueue).toBe(0);

        // can't put another one
        try {
            await chanInf.put(999, { timeout: 20 })
            expect('should have thrown an error').toBe(true);
        } catch (err) {
            expect(err instanceof Channel2IsClosedError).toBeTruthy();
        }

        // can't get another one
        try {
            await chanInf.get({ timeout: 20 })
            expect('should have thrown an error').toBe(true);
        } catch (err) {
            expect(err instanceof Channel2IsClosedError).toBeTruthy();
        }
    });

    test(`close with waiting puts`, async () => {
        let chanInf = new Chan2<number>(1);

        expect(chanInf.canImmediatelyPut).toBe(true);
        expect(chanInf.canImmediatelyGet).toBe(false);

        // load it up
        await chanInf.put(1);
        let waitingPut = chanInf.put(2, { timeout: 30 });

        expect(chanInf.itemsInQueue).toBe(1);
        expect(chanInf.itemsInQueueAndWaitingPuts).toBe(2);
        expect(chanInf.canImmediatelyPut).toBe(false);
        expect(chanInf.canImmediatelyGet).toBe(true);

        // close it
        chanInf.close();
        expect(chanInf.isSealed).toBe(false);
        expect(chanInf.isClosed).toBe(true);
        expect(chanInf.isIdle).toBe(true);
        expect(chanInf.itemsInQueue).toBe(0);
        expect(chanInf.itemsInQueueAndWaitingPuts).toBe(0);
        expect(chanInf.canImmediatelyPut).toBe(false);
        expect(chanInf.canImmediatelyGet).toBe(false);

        try {
            await waitingPut;
            expect('should have thrown an error').toBe(true);
        } catch (err) {
            expect(err instanceof Channel2IsClosedError).toBeTruthy();
        }
    });

    test(`close with waiting gets`, async () => {
        let chanInf = new Chan2<number>();

        let waitingGet = chanInf.get({ timeout: 30 });
        expect(chanInf.isIdle).toBe(false);

        // seal it
        chanInf.close();
        expect(chanInf.isSealed).toBe(false);
        expect(chanInf.isClosed).toBe(true);
        expect(chanInf.isIdle).toBe(true);

        try {
            await waitingGet;
            expect('should have thrown an error').toBe(true);
        } catch (err) {
            expect(err instanceof Channel2IsClosedError).toBeTruthy();
        }
    });
});

describe(`forEach`, () => {
    for (let CAPACITY of [0, 1, 2, 3, 4, 1000, null]) {
        test(`forEach with no timeout, then stop when channel is closed.  capacity=${CAPACITY}`, async () => {
            let chan = new Chan2<number>(CAPACITY);
            let thread1 = new Promise<void>(async (resolve, reject) => {
                await chan.put(1);
                await chan.put(2);
                await sleep(60);
                await chan.put(3);
                await chan.put(4);
                await sleep(5);  // give the consumer a chance to get the 4 before we close
                chan.close();
                resolve();
            });
            let receivedItems: number[] = [];
            let thread2 = new Promise<void>(async (resolve, reject) => {
                await sleep(40);
                await chan.forEach(item => {
                    receivedItems.push(item);
                });
                resolve();
            });
            await Promise.all([thread1, thread2]);
            expect(receivedItems).toEqual([1, 2, 3, 4]);
        });
    }

    for (let CAPACITY of [0, 1, 2, 3, 4, 1000, null]) {
        test(`forEach with no timeout, then stop when channel is sealed and drained.  capacity=${CAPACITY}`, async () => {
            let chan0 = new Chan2<number>(0);
            let thread1 = new Promise<void>(async (resolve, reject) => {
                await chan0.put(1);
                await chan0.put(2);
                await sleep(60);
                await chan0.put(3);
                await chan0.put(4);
                chan0.seal();
                resolve();
            });
            let receivedItems: number[] = [];
            let thread2 = new Promise<void>(async (resolve, reject) => {
                await sleep(40);
                await chan0.forEach(item => {
                    receivedItems.push(item);
                });
                resolve();
            });
            await Promise.all([thread1, thread2]);
            expect(receivedItems).toEqual([1, 2, 3, 4]);
        });
    }

    for (let CAPACITY of [0, 1, 2, 3, 4, 1000, null]) {
        test(`forEach stopping because of timeout:30.  capacity=${CAPACITY}`, async () => {
            let chan = new Chan2<number>(CAPACITY);
            let thread1 = new Promise<void>(async (resolve, reject) => {
                await sleep(10);
                await chan.put(1);
                await sleep(10);
                await chan.put(2);
                await sleep(10);
                await chan.put(3, { timeout: 100 });
                await sleep(60);  // forEach will timeout at this one
                if (CAPACITY === 0) {
                    try {
                        await chan.put(4, { timeout: 60 });  // this will time out when forEach has stopped
                        expect('should have thrown an error').toBe(true);
                    } catch (err) {
                        expect(err instanceof Channel2TimeoutError).toBe(true);
                    }
                } else {
                    await chan.put(4);  // there's room to put one after forEach stopps
                }
                resolve();
            });
            let receivedItems: number[] = [];
            let thread2 = new Promise<void>(async (resolve, reject) => {
                await chan.forEach(item => {
                    receivedItems.push(item);
                }, { timeout: 30 });
                resolve();
            });
            await Promise.all([thread1, thread2]);
            expect(receivedItems).toEqual([1, 2, 3]);
        });
    }

    test(`forEach stopping because of timeout:0.  capacity=null`, async () => {
        let chanInf = new Chan2<number>();
        let thread1 = new Promise<void>(async (resolve, reject) => {
            await chanInf.put(1);
            await chanInf.put(2);
            await chanInf.put(3);

            await sleep(70); // forEach will run during this sleep

            await chanInf.put(4);
            resolve();
        });
        let receivedItems: number[] = [];
        let thread2 = new Promise<void>(async (resolve, reject) => {
            await sleep(50);
            await chanInf.forEach(item => {
                receivedItems.push(item);
            }, { timeout: 0 });
            resolve();
        });
        await Promise.all([thread1, thread2]);
        expect(receivedItems).toEqual([1, 2, 3]);
    });

    test(`forEach with error in callback`, async () => {
        let chanInf = new Chan2<number>();
        await chanInf.put(1);
        await chanInf.put(2);
        await chanInf.put(3);

        let receivedItems: number[] = [];

        try {
            await chanInf.forEach(item => {
                if (item === 2) { throw new Error('two is a bad number'); }
                receivedItems.push(item);
            });
            expect('should have thrown an error').toBe(true);
        } catch (err) {
            expect(err.message).toBe('two is a bad number');
        }

        expect(receivedItems).toEqual([1]);  // stop at the error
    });

    test(`forEach with async callback`, async () => {
        let chanInf = new Chan2<number>();
        await chanInf.put(1);
        await chanInf.put(2);
        await chanInf.put(3);
        chanInf.seal();

        let receivedItems: number[] = [];

        await chanInf.forEach(async (item) => {
            receivedItems.push(item);
            await sleep(40);
            receivedItems.push(item);
        });

        // items should not be interleaved
        expect(receivedItems).toEqual([1, 1, 2, 2, 3, 3]);
    });
});
