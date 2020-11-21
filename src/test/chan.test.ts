import 'jest';

import { Chan } from '../chan';
import { sleep } from '../util';

//process.on('unhandledRejection', (reason : any, p : any) => {
//    console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
//});

test('capacity, length, canGet, canPut', async () => {
    let chan = new Chan<number>();
    expect(chan.capacity).toBe(null);
    expect(chan.length).toBe(0);
    expect(chan.canPutWithoutBlocking).toBe(true);
    expect(chan.canGetWithoutBlocking).toBe(false);
    await chan.put(1);
    expect(chan.canPutWithoutBlocking).toBe(true);
    expect(chan.canGetWithoutBlocking).toBe(true);
    expect(chan.length).toBe(1);

    chan = new Chan<number>(1);
    expect(chan.capacity).toBe(1);
    expect(chan.length).toBe(0);
    expect(chan.canPutWithoutBlocking).toBe(true);
    expect(chan.canGetWithoutBlocking).toBe(false);
    await chan.put(1);
    expect(chan.canPutWithoutBlocking).toBe(false);
    expect(chan.canGetWithoutBlocking).toBe(true);
    expect(chan.length).toBe(1);

    chan = new Chan<number>(0);
    expect(chan.capacity).toBe(0);
    expect(chan.canPutWithoutBlocking).toBe(false);
    expect(chan.canGetWithoutBlocking).toBe(false);
    expect(chan.length).toBe(0);
});

test('canGet and canPut with blocked read, buffer=0', async () => {
    let chan = new Chan<number>(0);
    expect(chan.canPutWithoutBlocking).toBe(false);
    expect(chan.canGetWithoutBlocking).toBe(false);
    let p = chan.get(50)
        .then(() => expect(true).toBe(false))
        .catch(e => expect('' + e).toBe('ChannelTimeoutError: get() timed out'));
    expect(chan.canPutWithoutBlocking).toBe(true);
    expect(chan.canGetWithoutBlocking).toBe(false);
    await p;
});

test('canGet and canPut with blocked write, buffer=0', async () => {
    let chan = new Chan<number>(0);
    expect(chan.canPutWithoutBlocking).toBe(false);
    expect(chan.canGetWithoutBlocking).toBe(false);
    let p = chan.put(1, 50)
        .then(() => expect(true).toBe(false))
        .catch(e => expect('' + e).toBe('ChannelTimeoutError: put() timed out'));
    expect(chan.canPutWithoutBlocking).toBe(false);
    expect(chan.canGetWithoutBlocking).toBe(true);
    await p;
});

test('first in, first out, put then get', async () => {
    let chan = new Chan<number>();
    await chan.put(1);
    await chan.put(2);
    await chan.put(3);
    expect(await chan.get()).toBe(1);
    expect(await chan.get()).toBe(2);
    expect(await chan.get()).toBe(3);
});

test('first in, first out, intermixed', async () => {
    let chan = new Chan<number>();
    await chan.put(1);
    await chan.put(2);
    expect(await chan.get()).toBe(1);
    await chan.put(3);
    expect(await chan.get()).toBe(2);
    expect(await chan.get()).toBe(3);
});

for (let TIMEOUT of [0, 10]) {
    test(`timeout on read.  timeout=${TIMEOUT}, buffer=undefined`, async () => {
        let chan = new Chan<number>();
        await chan.put(1);
        expect(await chan.get()).toBe(1);

        await chan.get(TIMEOUT)
            .then(() => expect(true).toBe(false))
            .catch(e => expect('' + e).toBe('ChannelTimeoutError: get() timed out'));
    });
}

for (let TIMEOUT of [0, 10]) {
    test(`read after timeout.  timeout=${TIMEOUT}, buffer=undefined`, async () => {
        let chan = new Chan<number>();
        await chan.get(TIMEOUT)
            .then(() => expect(true).toBe(false))
            .catch(e => expect('' + e).toBe('ChannelTimeoutError: get() timed out'));
        await chan.put(1);
        await chan.put(2);
        expect(await chan.get()).toBe(1);
        expect(await chan.get()).toBe(2);
    });
}

for (let TIMEOUT of [0, 10]) {
    for (let BUFFER of [0, 1, 5]) {
        test(`timeout on write.  timeout=${TIMEOUT}, buffer=${BUFFER}`, async () => {
            let chan = new Chan<number>(BUFFER);
            // fill the buffer
            for (let ii = 0; ii < BUFFER; ii++) {
                await chan.put(ii);
            }
            // write timeout
            await chan.put(999, TIMEOUT)
                .then(() => expect(true).toBe(false))
                .catch(e => expect('' + e).toBe('ChannelTimeoutError: put() timed out'));
        });
    }
}

for (let TIMEOUT of [0, 10]) {
    for (let BUFFER of [0, 1, 5]) {
        test(`write after timeout.  timeout=${TIMEOUT}, buffer=${BUFFER}`, async () => {
            let chan = new Chan<number>(BUFFER);
            // fill the buffer
            for (let ii = 0; ii < BUFFER; ii++) {
                await chan.put(ii);
            }
            // write timeout
            await chan.put(999, TIMEOUT)
                .then(() => expect(true).toBe(false))
                .catch(e => expect('' + e).toBe('ChannelTimeoutError: put() timed out'));
            // drain the buffer
            for (let ii = 0; ii < BUFFER; ii++) {
                expect(await chan.get()).toBe(ii);
            }
            // pull one more -- should not get anything
            await chan.get(TIMEOUT)
                .then(() => expect(true).toBe(false))
                .catch(e => expect('' + e).toBe('ChannelTimeoutError: get() timed out'));
        });
    }
}

for (let BUFFER of [0, 1, 2, 3, 4, 1000, undefined]) {
    test(`two threads.  buffer=${BUFFER}`, async () => {
        let chan = new Chan<number>(BUFFER);
        let thread1 = new Promise(async (resolve, reject) => {
            await chan.put(1);
            await chan.put(2);
            await sleep(60);
            await chan.put(3);
            await chan.put(4);
            resolve();
        });
        let thread2 = new Promise(async (resolve, reject) => {
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

for (let BUFFER of [0, 1, 2, 3, 4, 1000, undefined]) {
    test(`two threads fuzz test.  buffer=${BUFFER}`, async () => {
        let n = 50;
        let chan = new Chan<number>(BUFFER);
        let thread1 = new Promise(async (resolve, reject) => {
            for (let ii = 0; ii < n; ii++) {
                if (Math.random() < 0.5) {
                    await sleep(Math.random() * 10);
                }
                await chan.put(ii);
            }
            resolve();
        });
        let thread2 = new Promise(async (resolve, reject) => {
            for (let ii = 0; ii < n; ii++) {
                if (Math.random() < 0.5) {
                    await sleep(Math.random() * 10);
                }
                expect(await chan.get()).toBe(ii);
            }
            // pull one more -- should not get anything
            await chan.get(0)
                .then(() => expect(true).toBe(false))
                .catch(e => expect('' + e).toBe('ChannelTimeoutError: get() timed out'));
            resolve();
        });
        await Promise.all([thread1, thread2]);
    });
}

test(`closing channel with no activity happening`, async () => {
    let chan = new Chan<number>(1);
    expect(chan.isClosed).toBe(false);

    chan.close();
    expect(chan.isClosed).toBe(true);
    expect(chan.canPutWithoutBlocking).toBe(false);
    expect(chan.canGetWithoutBlocking).toBe(false);

    await chan.get(0)
        .then(() => expect(true).toBe(false))
        .catch(e => expect('' + e).toBe("ChannelIsClosedError: can't get() from a closed channel"));
    await chan.put(999, 0)
        .then(() => expect(true).toBe(false))
        .catch(e => expect('' + e).toBe("ChannelIsClosedError: can't put() to a closed channel"));
});

test(`closing channel with pending writes and a full buffer`, async () => {
    let chan = new Chan<number>(1);
    await chan.put(1);
    let p = chan.put(999, 30);  // start this now
    expect(chan.isClosed).toBe(false);
    expect(chan.length).toBe(1);
    expect(chan._waitingPuts.length).toBe(1);

    chan.close();
    expect(chan.isClosed).toBe(true);
    expect(chan.length).toBe(0);  // buffer was cleared
    expect(chan._waitingPuts.length).toBe(0);  // waiting puts were cleared
    expect(chan.canPutWithoutBlocking).toBe(false);
    expect(chan.canGetWithoutBlocking).toBe(false);

    await p  // look at p again, and now it should have been rejected
        .then(() => expect(true).toBe(false))
        .catch(e => expect('' + e).toBe("ChannelIsClosedError: can't put() to a closed channel"));

});

test(`closing channel with pending reads`, async () => {
    let chan = new Chan<number>(1);
    let p = chan.get(30);  // start this now
    expect(chan.isClosed).toBe(false);
    expect(chan.length).toBe(0);
    expect(chan._waitingGets.length).toBe(1);

    chan.close();
    expect(chan.isClosed).toBe(true);
    expect(chan.length).toBe(0);
    expect(chan._waitingGets.length).toBe(0);  // waiting gets were cleared
    expect(chan.canPutWithoutBlocking).toBe(false);
    expect(chan.canGetWithoutBlocking).toBe(false);

    await p  // look at p again, and now it should have been rejected
        .then(() => expect(true).toBe(false))
        .catch(e => expect('' + e).toBe("ChannelIsClosedError: can't get() from a closed channel"));
});

test(`forEach with no timeout then closing channel`, async () => {
    let chan = new Chan<number>(0);
    let thread1 = new Promise(async (resolve, reject) => {
        await chan.put(1);
        await chan.put(2);
        await sleep(60);
        await chan.put(3);
        await chan.put(4);
        await sleep(60);
        chan.close();
        resolve();
    });
    let receivedItems: number[] = [];
    let thread2 = new Promise(async (resolve, reject) => {
        await sleep(40);
        await chan.forEach(item => {
            receivedItems.push(item);
        });
        resolve();
    });
    await Promise.all([thread1, thread2]);
    expect(receivedItems).toEqual([1, 2, 3, 4]);
});

test(`forEachAwait with no timeout blocking forever then closing channel`, async () => {
    let chan = new Chan<number>(100);
    let receivedItems: number[] = [];
    let p1 = chan.forEachAwait(async (item) => {
        receivedItems.push(item);
        await sleep(100);
    });
    await chan.put(1);
    await chan.put(2);
    await chan.put(3);
    await chan.put(4);
    await sleep(50);
    await chan.close();
    await p1;
    // there was only time to grab one item before the channel was closed
    // the rest of the items were lost
    expect(receivedItems).toEqual([1]);
});

for (let TIMEOUT of [0, 10]) {
    test(`forEach.  timeout=${TIMEOUT}`, async () => {
        let num = 4;
        let delayAmt = 20;
        let chan = new Chan<number>();
        // fill up buffer
        for (let ii = 0; ii < num; ii++) {
            await chan.put(ii);
        }
        // expect that forEach will get each of those items, then stop
        let ii = 0;
        let startTime = Date.now();
        await chan.forEach(async (n) => {
            expect(n).toBe(ii);
            expect(n).toBeLessThan(num);
            ii += 1;
            await sleep(delayAmt);
        }, TIMEOUT);
        let endTime = Date.now();
        let expectedDuration = TIMEOUT;
        expect(endTime - startTime).toBeGreaterThanOrEqual(expectedDuration * 0.5 - 5);
        expect(endTime - startTime).toBeLessThanOrEqual(expectedDuration * 1.5 + 5);
        // pull one more -- should not get anything
        await chan.get(0)
            .then(() => expect(true).toBe(false))
            .catch(e => expect('' + e).toBe('ChannelTimeoutError: get() timed out'));
    });
}

for (let TIMEOUT of [0, 10]) {
    test(`forEachAwait.  timeout=${TIMEOUT}`, async () => {
        let num = 4;
        let delayAmt = 20;
        let chan = new Chan<number>();
        // fill up buffer
        for (let ii = 0; ii < num; ii++) {
            await chan.put(ii);
        }
        // expect that forEach will get each of those items, then stop
        let ii = 0;
        let startTime = Date.now();
        await chan.forEachAwait(async (n) => {
            expect(n).toBe(ii);
            expect(n).toBeLessThan(num);
            ii += 1;
            await sleep(delayAmt);
        }, TIMEOUT);
        let endTime = Date.now();
        let expectedDuration = delayAmt * num + TIMEOUT;
        expect(endTime - startTime).toBeGreaterThanOrEqual(expectedDuration * 0.5 - 5);
        expect(endTime - startTime).toBeLessThanOrEqual(expectedDuration * 1.5 + 5);
        // pull one more -- should not get anything
        await chan.get(0)
            .then(() => expect(true).toBe(false))
            .catch(e => expect('' + e).toBe('ChannelTimeoutError: get() timed out'));
    });
}
